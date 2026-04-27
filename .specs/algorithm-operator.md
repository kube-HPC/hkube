# Algorithm Operator Service Specification

## Overview

The **Algorithm Operator** is a Kubernetes-native reconciliation service that manages the lifecycle of multiple core hkube components within a Kubernetes cluster. It operates as a continuous reconciliation loop that ensures the desired state of cluster resources matches their actual state.

**Primary Responsibilities:**
- Pipeline-driver job creation and lifecycle management
- Algorithm queue deployment provisioning and scaling
- Algorithm build job orchestration
- Debug worker deployment management
- Tensorboard and Optunaboard management
- Resource allocation enforcement for Kubernetes pods

## Core Architecture

### Execution Model

The operator runs in **two primary reconciliation loops**:

```
Operator Init
    ↓
Main Reconciliation Loop (interval-driven)
    ├─ Algorithm Builds (db → reconciler → K8s jobs)
    ├─ Tensorboards (db → reconciler → K8s deployments)
    ├─ Optunaboards (db → reconciler → K8s deployments)
    ├─ Algorithm Debug (db → reconciler → K8s deployments)
    ├─ Algorithm Queues (db → reconciler → K8s deployments)
    ├─ Algorithm Gateways (db → reconciler → K8s deployments)
    └─ Pipeline Drivers (etcd + db → drivers-reconciler → K8s jobs) ← KEY FOR RESOURCE MANAGEMENT
    
Boards Update Loop (separate interval for tensorboard/optunaboard updates)
    └─ Update board status/metadata
```

**Configuration Parameters:**
- `intervalMs` (default: 10000ms) - Main reconciliation interval
- `boardsIntervalMs` (default: 2000ms) - Board updates interval
- `boardTimeOut` (default: 3 hours × 1000ms)

---

## Pipeline-Driver Resource Management

### 1. Resource Configuration Identity

Pipeline-driver jobs are created with resource specifications that flow through the following hierarchy:

#### Data Sources (in precedence order):
1. **Driver Template (MongoDB)** - Base configuration per driver type
2. **Global Settings** - Global resource limit flags
3. **Configuration Flags** - Enable/disable resource application

#### Configuration Entry Points:
| Source | Location | Purpose |
|--------|----------|---------|
| **Driver Template** | MongoDB: `db.pipelineDrivers` | Per-driver-type CPU/memory defaults |
| **Environment Variables** | `config.base.js` parsing | Runtime override of resource behavior |
| **Configuration Flags** | `config.resources` object | Feature flags for resource enforcement |
| **Settings Helper** | `lib/helpers/settings.js` | Global runtime state for resource decisions |

### 2. Driver Template Structure

Driver templates are stored in MongoDB and define common resource parameters for pipeline-driver instances:

```javascript
{
  name: "pipeline-driver",           // Driver type identifier
  image: "hkube/pipeline-driver",    // Container image reference
  cpu: 0.1,                          // CPU request (cores)
  mem: 128                           // Memory request (MB)
}
```

**Defaults (if template missing):**
- `cpu`: 0.1 cores
- `mem`: 4 MB (fallback minimum)

### 3. Resource Calculation Algorithm

**Function:** `createContainerResource(template)` → `{requests, limits}`

```javascript
const _createContainerResourceByFactor = ({ cpu, mem } = {}, factor = 1) => {
    const cpuFactored = (cpu || 0.1) * factor;
    const memory = `${(mem || 4) * factor}Mi`;
    return { cpu: cpuFactored, memory };
};

const createContainerResource = (template) => {
    // Extract from template with defaults
    const requests = _createContainerResourceByFactor(template || {}, 1);
    
    // Limits factor depends on feature flag
    const limitFactor = settings.useResourceLimits ? 1 : 2;
    const limits = _createContainerResourceByFactor(template || {}, limitFactor);
    
    return { requests, limits };
};
```

**Resource Scaling:**
| Setting | Requests Factor | Limits Factor |
|---------|-----------------|---------------|
| `useResourceLimits = true` | 1× | 1× (same as requests) |
| `useResourceLimits = false` | 1× | 2× (double requests) |

**Example Calculation:**
```
Template: { cpu: 0.1, mem: 128 }
With useResourceLimits = false:
  - Requests: { cpu: 0.1, memory: "128Mi" }
  - Limits: { cpu: 0.2, memory: "256Mi" }

With useResourceLimits = true:
  - Requests: { cpu: 0.1, memory: "128Mi" }
  - Limits: { cpu: 0.1, memory: "128Mi" }
```

### 4. Resource Application in Job Creation

**Pipeline-Driver Job Creation Flow:**

```
drivers-reconciler.reconcileDrivers()
    ↓
for each required driver:
    ├─ template = db.getDriversTemplate()[name]
    ├─ image = setPipelineDriverImage(template, versions, registry)
    ├─ resourceRequests = createContainerResource(template)
    └─ createDriverJobSpec({
        name,
        image,
        resourceRequests,  ← PASSED HERE
        clusterOptions,
        options
    })
    
createDriverJobSpec():
    ├─ Clone pipelineDriverTemplate
    ├─ Apply image
    ├─ Apply environment variables
    ├─ IF settings.applyResourceLimits:
    │   └─ applyResourceRequests(spec, resourceRequests, 'pipeline-driver') ← CONDITIONAL
    ├─ Apply Jaeger
    ├─ Apply storage
    ├─ Apply image pull secrets
    └─ Apply sidecars
    
Result: Kubernetes Job spec with/without resource constraints
```

### 5. Resource Configuration Control Flags

#### Feature Flags (from `config.resources`):

| Environment Variable | Config Key | Default | Effect |
|---------------------|-----------|---------|--------|
| `RESOURCES_ENABLE` | `resources.enable` | `false` | Master switch: applies all resource limits when `true` |
| `USE_RESOURCE_LIMITS` | `resources.useResourceLimits` | `false` | When `true`, limits = requests; when `false`, limits = 2× requests |
| `ALGORITHM_QUEUE_CPU` | `resources.algorithmQueue.cpu` | 0.1 | CPU for algorithm-queue (not pipeline-driver) |
| `ALGORITHM_QUEUE_MEMORY` | `resources.algorithmQueue.memory` | 256 | Memory for algorithm-queue (not pipeline-driver) |

#### Settings Application (from `lib/helpers/settings.js`):

```javascript
const setFromConfig = (config) => {
    if (!config) return;
    
    // Master settings that control resource behavior
    settings.applyResourceLimits = config.resources.enable;        // ← Main switch
    settings.useResourceLimits = config.resources.useResourceLimits; // ← Limit factor
    
    // These apply to algorithm-builder, not pipeline-driver
    settings.resourcesMain = config.resources.algorithmBuilderMain;
    settings.resourcesBuilder = config.resources.algorithmBuilderBuilder;
};
```

**Critical Path:**
```
RESOURCES_ENABLE=true (env var)
    ↓
config.resources.enable = true
    ↓
settings.applyResourceLimits = true
    ↓
createDriverJobSpec() applies resource requests to K8s manifest
```

---

## Pipeline-Driver Scaling & Concurrency

### Desired Driver Amount Calculation

**Function:** `normalizeDriversAmount(drivers, requests, settings)` → desired count

```javascript
const normalizeDriversAmount = (drivers, requests, settings) => {
    const { minAmount, maxAmount, concurrency } = settings;
    const current = drivers.length;
    
    // Calculate available slots across all current drivers
    const available = drivers
        .map(d => concurrency - d.jobs)
        .reduce((a, b) => a + b, 0);
    
    // Determine desired amount
    let amount = 0;
    if (current === 0) {
        // No drivers exist, start with minimum
        amount = minAmount;
    } else if (requests > available) {
        // More requests than current capacity
        // Scale up to meet demand
        amount = (requests - available) / concurrency;
        amount = current + Math.ceil(amount);
        amount = Math.min(amount, maxAmount); // Cap at max
    }
    
    return amount;
};
```

### Scaling Parameters (from `config.driversSetting`)

| Environment Variable | Config Key | Default | Meaning |
|---------------------|-----------|---------|---------|
| `PIPELINE_DRIVERS_AMOUNT` | `minAmount` | 5 | Minimum drivers to maintain |
| `PIPELINE_DRIVERS_SCALE_PERCENT` | `scalePercent` | 0.5 | Scale factor for max calculation |
| `PIPELINE_DRIVERS_CONCURRENCY_LIMIT` | `concurrency` | 5 | Max jobs per driver before scaling |
| `PIPELINE_DRIVERS_RECONCILE_INTERVAL` | `reconcileInterval` | 5000ms | (Reserved, not currently used) |

### Max Driver Calculation

```javascript
maxAmount = Math.ceil(minAmount * scalePercent) + minAmount

Example:
  minAmount = 5
  scalePercent = 0.5
  maxAmount = ceil(5 × 0.5) + 5 = ceil(2.5) + 5 = 3 + 5 = 8
```

### Driver Lifecycle

**Creation Trigger:**
- External service (e.g., pipeline-driver-queue) sends requests to etcd
- Operator reads requests: `etcd.pipelineDrivers.requirements.list()`
- If `(requests > available_capacity)`, create new drivers

**Stopping Logic:**
```javascript
idleDrivers = drivers.filter(d => d.idle && !d.paused)
extra = idleDrivers.length - minAmount

if (extra > 0) {
    // Stop excess idle drivers (keep minimum)
    extraDrivers = idleDrivers.slice(0, extra)
    for each in extraDrivers:
        etcd.drivers.set({ driverId, status: { command: 'stopProcessing' } })
}
```

---

## Configuration Sources and Precedence

### Complete Configuration Flow

```
Environment Variables
    ↓
config.base.js (runtime config object)
    ├─ config.resources (resource settings)
    ├─ config.driversSetting (driver scaling)
    └─ config.kubernetes (cluster config)
    ↓
bootstrap.init() → setFromConfig(main)
    ↓
Global settings object (lib/helpers/settings.js)
    ├─ settings.applyResourceLimits
    ├─ settings.useResourceLimits
    └─ (read by subsequent operations)
    ↓
Operational Code:
    ├─ drivers-reconciler → createContainerResource()
    ├─ jobCreator → createDriverJobSpec()
    └─ K8s Job Manifest
```

### Environment Variable Reference

```bash
# Resource Configuration
export RESOURCES_ENABLE=true                          # Master switch
export USE_RESOURCE_LIMITS=false                      # Limits = 2× requests (false) or = requests (true)
export ALGORITHM_QUEUE_CPU=0.1                        # (Not pipeline-driver)
export ALGORITHM_QUEUE_MEMORY=256                     # (Not pipeline-driver)

# Pipeline-Driver Scaling
export PIPELINE_DRIVERS_AMOUNT=5                      # Minimum drivers
export PIPELINE_DRIVERS_SCALE_PERCENT=0.5             # Max = ceil(min × percent) + min
export PIPELINE_DRIVERS_CONCURRENCY_LIMIT=5           # Jobs per driver before scaling

# Reconciliation Timing
export INTERVAL_MS=10000                              # Main loop interval
export BOARDS_INTERVAL_MS=2000                        # Board updates interval
```

---

## Current Resource Configuration Gaps & Future Enhancements

### Current Limitations

| Gap | Impact | Workaround |
|-----|--------|-----------|
| **No per-job resource override** | All drivers use template values | Update template in DB or use global settings |
| **No GPU resource support** | GPU requests not configurable | Would need template enhancement |
| **No memory/CPU limits override** | Limits always 1× or 2× of requests | Change `USE_RESOURCE_LIMITS` flag |
| **No storage resource config** | No persistent storage limits | Not currently needed for pipeline-driver |
| **No QoS class specification** | All jobs use default QoS | Require template field addition |
| **No pod disruption budgets** | No explicit HA configuration | Kubernetes default policy applies |

### Proposed Configuration Enhancements

#### 1. Per-Job Resource Override (Future)

```javascript
// Pipeline-driver request could carry resource hints
{
  name: 'pipeline-driver',
  resources: {
    cpu: 0.2,      // Override template default
    memory: 256,
    gpu: 1
  }
}

// Driver template would check for override first
const driverTemplate = driverTemplates[name];
const requestedResources = driverRequest.resources || driverTemplate;
const resourceRequests = createContainerResource(requestedResources);
```

#### 2. GPU Support (Future)

```javascript
// Template enhancement:
{
  name: "pipeline-driver",
  image: "hkube/pipeline-driver",
  cpu: 0.1,
  mem: 128,
  gpu: {
    count: 1,
    type: "nvidia.com/gpu"  // or "amd.com/gpu"
  }
}

// createContainerResource would generate:
{
  requests: {
    cpu: 0.1,
    memory: "128Mi",
    "nvidia.com/gpu": 1
  },
  limits: {
    cpu: 0.2,
    memory: "256Mi",
    "nvidia.com/gpu": 1
  }
}
```

#### 3. QoS Class Configuration (Future)

```javascript
// Template enhancement:
{
  name: "pipeline-driver",
  qosClass: "Guaranteed"  // or "Burstable", "BestEffort"
}

// Effect: If requests ≠ limits, Kubernetes assigns to that QoS tier
// If requests = limits, Kubernetes automatically assigns "Guaranteed"
```

---

## Integration Points with Other Services

### Upstream Dependencies (Trigger Sources)

| Service | Interface | Data Flow | Purpose |
|---------|-----------|-----------|---------|
| **Pipeline-Driver-Queue** | etcd: `pipelineDrivers.requirements` | Sends requests with count | Requests new drivers when jobs queued |
| **MongoDB** | `db.pipelineDrivers.fetchAll()` | Driver templates with cpu/mem | Resource defaults per driver type |
| **Kubernetes API** | `kubernetes.getPipelineDriversJobs()` | Current job state | Detects completed/failed jobs |

### Downstream Consumers (Outputs)

| Service | Interface | Data Flow | Purpose |
|---------|-----------|-----------|---------|
| **Kubernetes** | K8s Job API | Creates Job manifests | Instantiates pipeline-driver pods |
| **Etcd** | `etcd.drivers.set()` | Stop commands | Signal drivers to pause |

### Message Flow Diagram

```
Pipeline-Driver-Queue
    ↓ (etcd write)
etcd: pipelineDrivers.requirements[{ name: 'pipeline-driver', ...requests }]
    ↓
Algorithm-Operator (polling interval)
    ├─ Read from etcd: getPipelineDriverRequests()
    ├─ Read from DB: getDriversTemplate()
    ├─ Reconcile desired vs actual state
    └─ Create missing drivers
        ├─ createDriverJobSpec() with resourceRequests
        └─ kubernetes.createJob(spec)
            ↓
Kubernetes
    └─ Pod scheduling with resources.requests and resources.limits
```

---

## Resource Enforcement in Kubernetes

### Job Manifest Structure (Post Resource Application)

When `RESOURCES_ENABLE=true`, the generated Job manifest includes:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: pipeline-driver-[random-suffix]
  labels:
    type: pipeline-driver
    group: hkube
spec:
  template:
    spec:
      serviceAccountName: pipeline-driver-serviceaccount
      containers:
      - name: pipeline-driver
        image: hkube/pipeline-driver:v1.x.x
        resources:
          requests:
            cpu: "100m"        # ← From template via createContainerResource()
            memory: "128Mi"
          limits:
            cpu: "200m"        # ← 2× requests if useResourceLimits=false
            memory: "256Mi"
        env:
          - name: POD_NAME
            valueFrom:
              fieldRef:
                fieldPath: metadata.name
          - name: POD_ID
            valueFrom:
              fieldRef:
                fieldPath: metadata.uid
          - name: CONCURRENCY_LIMIT
            valueFrom:
              configMapKeyRef:
                name: algorithm-operator-configmap
                key: PIPELINE_DRIVERS_CONCURRENCY_LIMIT
          # ... additional env vars from template
      restartPolicy: Never
  backoffLimit: 0
```

### Kubernetes Resource Behavior

| Field | Behavior | Implication |
|-------|----------|-------------|
| `resources.requests` | Scheduler uses for placement | Pod guaranteed minimum resources |
| `resources.limits` | Cgroup enforces upper bound | Pod killed if exceeds limits |
| `requests = limits` | Kubernetes assigns QoS: Guaranteed | Pod prioritized during evictions |
| `requests < limits` | Kubernetes assigns QoS: Burstable | Pod eligible for eviction under pressure |

---

## Testing & Validation

### Unit Tests (examples from `/tests/pipeline-drivers.js`)

```javascript
// Test: Resources applied only when flag enabled
it('should apply resources', () => {
    globalSettings.applyResourceLimits = true;
    const res = createDriverJobSpec({
        options,
        image: 'myImage1',
        resourceRequests: { 
            requests: { cpu: '200m' }, 
            limits: { cpu: '500m', memory: '200M' }
        }
    });
    expect(res.spec.template.spec.containers[0].resources).to.deep.include({ 
        requests: { cpu: '200m' }, 
        limits: { cpu: '500m', memory: '200M' } 
    });
});

// Test: Resources not applied when flag disabled
it('should not apply resources', () => {
    globalSettings.applyResourceLimits = false; // ← KEY FLAG
    const res = createDriverJobSpec({
        options,
        image: 'myImage1',
        resourceRequests: { 
            requests: { cpu: '200m' }, 
            limits: { cpu: '500m', memory: '200M' } 
        }
    });
    expect(res.spec.template.spec.containers[0].resources).to.not.exist;
});
```

### Configuration Test Scenarios

```bash
# Scenario 1: Resources Disabled (current default)
RESOURCES_ENABLE=false
→ K8s Job created with NO resource limits
→ Pod runs with unbounded CPU/memory

# Scenario 2: Resources Enabled, Limits = 2× Requests
RESOURCES_ENABLE=true
USE_RESOURCE_LIMITS=false
Template: { cpu: 0.1, mem: 128 }
→ requests: { cpu: 0.1, memory: 128Mi }
→ limits: { cpu: 0.2, memory: 256Mi }
→ QoS: Burstable (can be evicted under pressure)

# Scenario 3: Resources Enabled, Limits = Requests (Guaranteed QoS)
RESOURCES_ENABLE=true
USE_RESOURCE_LIMITS=true
Template: { cpu: 0.1, mem: 128 }
→ requests: { cpu: 0.1, memory: 128Mi }
→ limits: { cpu: 0.1, memory: 128Mi }
→ QoS: Guaranteed (protected from eviction)
```

---

## Operator Reconciliation Interval Details

### Main Reconciliation Loop: `operator._interval()`

**Execution Sequence (per loop iteration):**

```javascript
async _interval(options) {
    record timer start
    try {
        const configMap = kubernetes.getVersionsConfigMap()
        const algorithms = db.getAlgorithmTemplates()
        await Promise.all([
            _algorithmBuilds(),              // Job creation for builds
            _tensorboards(),                 // Deployment management
            _optunaboards(),                 // Deployment management
            _algorithmDebug(),               // Deployment management
            _algorithmQueue(),               // Deployment management (with resources)
            _algorithmGateways(),            // Deployment management
            _pipelineDriversHandle()         // ← KEY: DRIVER RESOURCE RECONCILIATION
        ])
    } catch (error) {
        log throttled error
    } finally {
        schedule next interval (default: 10000ms)
    }
}
```

**Driver-Specific Reconciliation: `_pipelineDriversHandle()`**

```javascript
async _pipelineDriversHandle({versions, registry, clusterOptions}, options) {
    // Fetch current state from multiple sources
    const [driverTemplates, driversRequests, drivers, jobs] = await Promise.all([
        db.getDriversTemplate(),                    // Templates with cpu/mem
        etcd.getPipelineDriverRequests(),           // Desired count
        etcd.getPipelineDrivers(),                  // Current drivers (discovery)
        kubernetes.getPipelineDriversJobs()         // Current K8s jobs
    ])
    
    // Core reconciliation with resource info passed through
    await driversReconciler.reconcileDrivers({
        driverTemplates,                            // ← Resource templates
        driversRequests,
        drivers,
        jobs,
        versions,
        settings: this._driversSettings,            // min/max amounts, concurrency
        registry,
        options,                                    // ← Global options (RESOURCES_ENABLE, etc.)
        clusterOptions
    })
}
```

---

## Error Handling & Resilience

### Resource Application Errors

```javascript
// If template missing or invalid
createContainerResource(template || {})
  → Falls back to defaults: cpu=0.1, mem=4

// If settings not initialized
if (!settings.applyResourceLimits)
  → Defaults to false (resources NOT applied)

// If Kubernetes rejects job manifest
kubernetes.createJob() → throws error
  → Throttled logging (not every iteration)
  → Retry on next reconciliation loop
```

### Configuration Errors

```javascript
// If RESOURCES_ENABLE not a boolean:
formatter.parseBool(process.env.RESOURCES_ENABLE, false)
  → Defaults to false if unparseable

// If CPU/memory env vars invalid:
parseFloat() / formatter.parseInt() with defaults
  → Falls back to hardcoded defaults
```

---

## Summary: Resource Configuration Contract

### Critical Dependencies

1. **Database** (MongoDB): Must contain pipeline-driver template with `cpu` and `mem` fields
2. **Configuration**: `RESOURCES_ENABLE` flag must be `true` for limits to apply
3. **Settings Module**: Must be initialized via `setFromConfig(main)` before resource creation
4. **Kubernetes Client**: Must provide `applyResourceRequests` utility

### Resource Guarantee Chain

```
Driver Template (MongoDB)
  → cpu/mem fields present
  → createContainerResource() extracts values
  → calculateFactor() scales by 1× or 2×
  → createDriverJobSpec() conditionally applies
  → IF settings.applyResourceLimits = true
    → K8s Job manifest includes resources
    → Kubernetes enforces via cgroup/QoS
  → ELSE
    → resources field omitted
    → Pod runs with no constraints
```

### Configuration to Behavior Matrix

| Config | Flag | Result |
|--------|------|--------|
| `RESOURCES_ENABLE=false` | - | Job has NO resource section → unbounded |
| `RESOURCES_ENABLE=true` + `USE_RESOURCE_LIMITS=false` | - | limits = 2× requests → Burstable QoS |
| `RESOURCES_ENABLE=true` + `USE_RESOURCE_LIMITS=true` | - | limits = requests → Guaranteed QoS |

---

## References

**Code Locations:**
- Entry Point: [app.js](../core/algorithm-operator/app.js) → [bootstrap.js](../core/algorithm-operator/bootstrap.js)
- Operator Main Loop: [lib/operator.js](../core/algorithm-operator/lib/operator.js)
- Driver Reconciliation: [lib/reconcile/drivers-reconciler.js](../core/algorithm-operator/lib/reconcile/drivers-reconciler.js)
- Job Creation: [lib/jobs/jobCreator.js](../core/algorithm-operator/lib/jobs/jobCreator.js)
- Resource Calculation: [lib/reconcile/createOptions.js](../core/algorithm-operator/lib/reconcile/createOptions.js)
- Settings Management: [lib/helpers/settings.js](../core/algorithm-operator/lib/helpers/settings.js)
- Configuration: [config/main/config.base.js](../core/algorithm-operator/config/main/config.base.js)
- Templates: [lib/templates/pipeline-driver.js](../core/algorithm-operator/lib/templates/pipeline-driver.js)
- Tests: [tests/pipeline-drivers.js](../core/algorithm-operator/tests/pipeline-drivers.js), [tests/jobsCreatorTests.js](../core/algorithm-operator/tests/jobsCreatorTests.js)

---

**Document Version:** 1.0  
**Last Updated:** April 2026  
**Spec Mode:** Reverse-Engineered from Algorithm-Operator v1.x
