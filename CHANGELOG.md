# Changelog

## [v1.3.147](https://github.com/kube-HPC/hkube/tree/v1.3.147) (2020-10-20)

**Fixed bugs:**

- Swagger api exec/algorithm does not accept any input that isn't an empty list [\#985](https://github.com/kube-HPC/hkube/issues/985)
- Fail to "Run Node" when data received from flowInput  [\#969](https://github.com/kube-HPC/hkube/issues/969)
- Debug url does not contain ingress prefix [\#961](https://github.com/kube-HPC/hkube/issues/961)
- hkubectl Issues [\#881](https://github.com/kube-HPC/hkube/issues/881)
- stopping node that contain the ETCD LEADER cased the HKUBE to stop working [\#927](https://github.com/kube-HPC/hkube/issues/927)
- Support self signed repositories for kaniko build [\#427](https://github.com/kube-HPC/hkube/issues/427)
- python wrapper does not work with s3 [\#887](https://github.com/kube-HPC/hkube/issues/887)
- Pipeline driver queue got stuck after ETCD disconnection [\#942](https://github.com/kube-HPC/hkube/issues/942)
- deleted algorithm  are not deleted from the ETCD /algorithms/queue/ [\#928](https://github.com/kube-HPC/hkube/issues/928)
- Replying for the "get from peer" request  cause the algorithm to crash due to out of memory  [\#921](https://github.com/kube-HPC/hkube/issues/921)
- download node result \(if it contains more then 1 MB \) should perform the same as download pipeline result [\#910](https://github.com/kube-HPC/hkube/issues/910)
- Algorithm Queue uncaughtException: Watcher canceled: [\#894](https://github.com/kube-HPC/hkube/issues/894)
- Wrong monitor-server path in helm chart [\#945](https://github.com/kube-HPC/hkube/issues/945)
- Thing to solved for 1.5 [\#922](https://github.com/kube-HPC/hkube/issues/922)
- build algorithm new version change the algorithm entry point [\#880](https://github.com/kube-HPC/hkube/issues/880)
- "Run Node" on batch  [\#919](https://github.com/kube-HPC/hkube/issues/919)
- when handling big size data and reaching the cluster memory  limits the Task executor does not release idel pods [\#932](https://github.com/kube-HPC/hkube/issues/932)
- java algorithm code APIs should receive MAP or list and return MAP   [\#889](https://github.com/kube-HPC/hkube/issues/889)
- Low TTL [\#863](https://github.com/kube-HPC/hkube/issues/863)
- UI crash when one user delete an object that other user view [\#856](https://github.com/kube-HPC/hkube/issues/856)
- 700MB input case the Resource Manager to stuck [\#920](https://github.com/kube-HPC/hkube/issues/920)
- Worker cash size casing the pod to terminate [\#904](https://github.com/kube-HPC/hkube/issues/904)
- Get data from Peer function when dealing with big data [\#903](https://github.com/kube-HPC/hkube/issues/903)
- pipeline with batch stuck with node "storing" [\#902](https://github.com/kube-HPC/hkube/issues/902)
- Debug worker and Algorithms should have same default discovery encoding [\#842](https://github.com/kube-HPC/hkube/issues/842)
- Missing timeout on debug worker client side of discovery communication [\#841](https://github.com/kube-HPC/hkube/issues/841)
- Unable to delete algorithm properties once added [\#792](https://github.com/kube-HPC/hkube/issues/792)
- Known UI Issues [\#525](https://github.com/kube-HPC/hkube/issues/525)
- API server miss validate node input [\#893](https://github.com/kube-HPC/hkube/issues/893)
- API server crash  when the storage is too big [\#740](https://github.com/kube-HPC/hkube/issues/740)
- cannot create storage buckets when clusterName has a period in the name [\#655](https://github.com/kube-HPC/hkube/issues/655)
- Redis Storage filled up  [\#790](https://github.com/kube-HPC/hkube/issues/790)
- hkubectl sync watch does not copy the source file to the algorithm mount storage [\#890](https://github.com/kube-HPC/hkube/issues/890)
- Java build logs size [\#855](https://github.com/kube-HPC/hkube/issues/855)
- Etcd issues [\#793](https://github.com/kube-HPC/hkube/issues/793)
- sometime algorithm does not get results from previous alg  [\#885](https://github.com/kube-HPC/hkube/issues/885)
- Node worker fail to read batch result  [\#886](https://github.com/kube-HPC/hkube/issues/886)
- GPU pipeline take all GPU resources none GPU pipeline are pending \(evens that the none GPU resource are available \) [\#795](https://github.com/kube-HPC/hkube/issues/795)
- Field pipeline staid in "pending" \(Due to fail communication to ETCD\) [\#794](https://github.com/kube-HPC/hkube/issues/794)
- opengl algorithm does not work [\#780](https://github.com/kube-HPC/hkube/issues/780)
- Different priority Pipelines with Different algorithm [\#722](https://github.com/kube-HPC/hkube/issues/722)
- Tensorboard status not updated to running when running in a different namespace [\#865](https://github.com/kube-HPC/hkube/issues/865)
- API server does not read configuration from config file [\#797](https://github.com/kube-HPC/hkube/issues/797)
- Github example algorithm should be using the new wrapper [\#826](https://github.com/kube-HPC/hkube/issues/826)
- Can't install HKube on Kubernetes 1.16 [\#540](https://github.com/kube-HPC/hkube/issues/540)
- concurrent Pipelines  works only within the experiment [\#746](https://github.com/kube-HPC/hkube/issues/746)
- Known issues [\#477](https://github.com/kube-HPC/hkube/issues/477)
- caching wait any  - input equal null [\#852](https://github.com/kube-HPC/hkube/issues/852)
- in debug  "hkubeapi.start\_algorithm" and "start\_stored\_subpipeline" with "resultAsRaw=True" does not return results [\#830](https://github.com/kube-HPC/hkube/issues/830)
- this.\_nodes.getWaitAny is not a function  [\#747](https://github.com/kube-HPC/hkube/issues/747)
- wait any + batch return different result each run [\#825](https://github.com/kube-HPC/hkube/issues/825)
- randomPipeStored pipeline got stוck once in few hours [\#779](https://github.com/kube-HPC/hkube/issues/779)
- authorization error when working with private repository in gitlab \(works with github \) [\#840](https://github.com/kube-HPC/hkube/issues/840)
- Algorithm Close abnormal  [\#604](https://github.com/kube-HPC/hkube/issues/604)
- Duplicated sub-piplines [\#603](https://github.com/kube-HPC/hkube/issues/603)
- when node has more then one inputs and one of them is "flowInput=null" the node is being skipped [\#832](https://github.com/kube-HPC/hkube/issues/832)
- pause and resume batch on batch pipeline  [\#823](https://github.com/kube-HPC/hkube/issues/823)
- fail to build gitlab algorithm [\#822](https://github.com/kube-HPC/hkube/issues/822)
- pipeline driver out of memory [\#809](https://github.com/kube-HPC/hkube/issues/809)
- run node \(execute caching\)  on a batch [\#781](https://github.com/kube-HPC/hkube/issues/781)
- validate pipeline input when input equal null [\#737](https://github.com/kube-HPC/hkube/issues/737)
- sometime worker complete its job but does not change its status to  done [\#718](https://github.com/kube-HPC/hkube/issues/718)
- worker displayed as active when pipeline failed [\#686](https://github.com/kube-HPC/hkube/issues/686)
- Graph is Unreadable in some cases [\#656](https://github.com/kube-HPC/hkube/issues/656)
- github build  ignor the commitid [\#770](https://github.com/kube-HPC/hkube/issues/770)
- Experiment Issues [\#744](https://github.com/kube-HPC/hkube/issues/744)
- delete "main" experiment cause the dashboard to crash  [\#778](https://github.com/kube-HPC/hkube/issues/778)
- invalid task status exit [\#709](https://github.com/kube-HPC/hkube/issues/709)
- subpipeline tracing fix [\#591](https://github.com/kube-HPC/hkube/issues/591)
- Experiment name validation [\#791](https://github.com/kube-HPC/hkube/issues/791)
- GPU - clean unused worker  [\#783](https://github.com/kube-HPC/hkube/issues/783)


**Closed issues:**
- Changing attributes or image of an algorithm should restart any of the algorithm pod where worker is in ready state.   [\#319](https://github.com/kube-HPC/hkube/issues/319)
- Add support for ImagePullSecrets [\#924](https://github.com/kube-HPC/hkube/issues/924)
- Algorithm definition should include the output mime type  \(jpg, json,txt .....\) [\#877](https://github.com/kube-HPC/hkube/issues/877)
- while algorithm is serving other algorithm "get from peer" request it should not go down [\#911](https://github.com/kube-HPC/hkube/issues/911)
- Improve travis yml [\#872](https://github.com/kube-HPC/hkube/issues/872)
- Debug disconnection [\#845](https://github.com/kube-HPC/hkube/issues/845)
- Check Node 14 - and upgrade [\#835](https://github.com/kube-HPC/hkube/issues/835)
- if the necessary data can be found in the worker or the cache or the get from peer fail once . the "get from peer" should not be executed [\#912](https://github.com/kube-HPC/hkube/issues/912)
- Errors in Worker [\#848](https://github.com/kube-HPC/hkube/issues/848)
- debug and run existing algorithm with single click [\#705](https://github.com/kube-HPC/hkube/issues/705)
- add --wait to hkubectl pipeline run [\#434](https://github.com/kube-HPC/hkube/issues/434)
- Download result [\#815](https://github.com/kube-HPC/hkube/issues/815)
- Missing useful batch operations for multiple batch parameters [\#660](https://github.com/kube-HPC/hkube/issues/660)
- Job Graph: add sub-pipelines and code-algorithms links [\#750](https://github.com/kube-HPC/hkube/issues/750)
- If pipeline was unable to be executed due to resource problem the rezone should be displayed [\#803](https://github.com/kube-HPC/hkube/issues/803)
- shorten job and task id [\#860](https://github.com/kube-HPC/hkube/issues/860)
- Java algorithm builder [\#789](https://github.com/kube-HPC/hkube/issues/789)
- Show tensorboard while algorithm is running. [\#681](https://github.com/kube-HPC/hkube/issues/681)
- Streaming [\#672](https://github.com/kube-HPC/hkube/issues/672)
- View analysis of algorithm using tensorflow , in Tensorboard  [\#610](https://github.com/kube-HPC/hkube/issues/610)
- the fail logic in streaming pipeline should act differently so hkube will create a new algorithm container on each crash [\#590](https://github.com/kube-HPC/hkube/issues/590)
- the batch phases in the streaming pipeline should increase and decrease its instances according to the pipeline workload   [\#589](https://github.com/kube-HPC/hkube/issues/589)
- the streaming layer should have an abstraction layer so it will be possibly to switch between streaming framework seamlessly  [\#588](https://github.com/kube-HPC/hkube/issues/588)
- Pipeline repository management [\#72](https://github.com/kube-HPC/hkube/issues/72)
- Caching Service [\#814](https://github.com/kube-HPC/hkube/issues/814)
- Code-API catch WS events properly [\#851](https://github.com/kube-HPC/hkube/issues/851)
- Add type to a pipeline that in debug/dev mode [\#843](https://github.com/kube-HPC/hkube/issues/843)
- Task Level HW Resource Requirements [\#749](https://github.com/kube-HPC/hkube/issues/749)
- update the hkubectl [\#628](https://github.com/kube-HPC/hkube/issues/628)
- Etcd Tuning  [\#15](https://github.com/kube-HPC/hkube/issues/15)
- Stop build [\#834](https://github.com/kube-HPC/hkube/issues/834)
- delete pipeline should stop all active and pending pipeline  [\#820](https://github.com/kube-HPC/hkube/issues/820)
- add kibana and grafana dashboards automatically on HKube deployment [\#666](https://github.com/kube-HPC/hkube/issues/666)
- missing pagination for batched algorithm [\#600](https://github.com/kube-HPC/hkube/issues/600)
- Python Wrapper: get access to pipeline's flowInput [\#663](https://github.com/kube-HPC/hkube/issues/663)
- FlowInput [\#811](https://github.com/kube-HPC/hkube/issues/811)
- algorithm with no github commit [\#819](https://github.com/kube-HPC/hkube/issues/819)
- Code API [\#513](https://github.com/kube-HPC/hkube/issues/513)
- Trigger execution flowInput is incorrect [\#679](https://github.com/kube-HPC/hkube/issues/679)
- Algorithm version is not specified in dashboard "Worker" details [\#658](https://github.com/kube-HPC/hkube/issues/658)
- Missing JOB ID for batch algorithm in Node Information-\> Input output Details [\#599](https://github.com/kube-HPC/hkube/issues/599)
- Etcd UI short timeout [\#729](https://github.com/kube-HPC/hkube/issues/729)
- Missing easy access to tasks logs after worker is down [\#661](https://github.com/kube-HPC/hkube/issues/661)
- Automatically create new algorithm if image changes [\#385](https://github.com/kube-HPC/hkube/issues/385)
- thinking off the ability for auto build  algorithm after github hooks  [\#372](https://github.com/kube-HPC/hkube/issues/372)
- add the ability to build algorithm from url  [\#371](https://github.com/kube-HPC/hkube/issues/371)
- Allow runing a pipeline in reoccurring mode, starting again when pipeline ends.  [\#343](https://github.com/kube-HPC/hkube/issues/343)
- Add support for builds on OpenShift [\#755](https://github.com/kube-HPC/hkube/issues/755)
- Support for OpenGL algorithms [\#701](https://github.com/kube-HPC/hkube/issues/701)

**Merged pull requests:**

- copy to local repository [\#989](https://github.com/kube-HPC/hkube/pull/989) ([golanha](https://github.com/golanha))
- remove -it on docker get dependency [\#987](https://github.com/kube-HPC/hkube/pull/987) ([golanha](https://github.com/golanha))
- Support offline installation [\#986](https://github.com/kube-HPC/hkube/pull/986) ([golanha](https://github.com/golanha))
- bring debs for dockerfile install [\#975](https://github.com/kube-HPC/hkube/pull/975) ([golanha](https://github.com/golanha))
- control pipeline-driver resources [\#984](https://github.com/kube-HPC/hkube/pull/984) ([yehiyam](https://github.com/yehiyam))
- change default algorithms resources [\#980](https://github.com/kube-HPC/hkube/pull/980) ([yehiyam](https://github.com/yehiyam))
- add ALGORITHM\_DISCONNECTED\_TIMEOUT\_MS to template [\#978](https://github.com/kube-HPC/hkube/pull/978) ([yehiyam](https://github.com/yehiyam))
- fix: caching flowInput [\#971](https://github.com/kube-HPC/hkube/pull/971) ([NassiHarel](https://github.com/NassiHarel))
- add algorithm memory as environment variable [\#963](https://github.com/kube-HPC/hkube/pull/963) ([golanha](https://github.com/golanha))
- add warning for algorithm-queue not created [\#967](https://github.com/kube-HPC/hkube/pull/967) ([yehiyam](https://github.com/yehiyam))
- update python wrapper in builder to version 2.0.28 [\#964](https://github.com/kube-HPC/hkube/pull/964) ([hkube-ci](https://github.com/hkube-ci))
- add ingress prefix to debug url [\#962](https://github.com/kube-HPC/hkube/pull/962) ([yehiyam](https://github.com/yehiyam))
- feat: add memoryCache [\#954](https://github.com/kube-HPC/hkube/pull/954) ([NassiHarel](https://github.com/NassiHarel))
- update nodejs wrapper to 2.0.22 [\#953](https://github.com/kube-HPC/hkube/pull/953) ([hkube-ci](https://github.com/hkube-ci))
- update nodejs wrapper to 2.0.21 [\#952](https://github.com/kube-HPC/hkube/pull/952) ([hkube-ci](https://github.com/hkube-ci))
- update nodejs wrapper to 2.0.20 [\#951](https://github.com/kube-HPC/hkube/pull/951) ([hkube-ci](https://github.com/hkube-ci))
- update python wrapper in builder to version 2.0.24 [\#950](https://github.com/kube-HPC/hkube/pull/950) ([hkube-ci](https://github.com/hkube-ci))
- update nodejs wrapper to 2.0.19 [\#949](https://github.com/kube-HPC/hkube/pull/949) ([hkube-ci](https://github.com/hkube-ci))
- update nodejs wrapper to 2.0.18 [\#948](https://github.com/kube-HPC/hkube/pull/948) ([hkube-ci](https://github.com/hkube-ci))
- algorithm terminating take too long   [\#941](https://github.com/kube-HPC/hkube/issues/941)
- feat: add get custom data with metadata [\#947](https://github.com/kube-HPC/hkube/pull/947) ([NassiHarel](https://github.com/NassiHarel))
- feat: change to reserved memory [\#958](https://github.com/kube-HPC/hkube/pull/958) ([NassiHarel](https://github.com/NassiHarel))
- update python wrapper in builder to version 2.0.23 [\#946](https://github.com/kube-HPC/hkube/pull/946) ([hkube-ci](https://github.com/hkube-ci))
- update etcd package [\#943](https://github.com/kube-HPC/hkube/pull/943) ([yehiyam](https://github.com/yehiyam))
- update python wrapper in builder to version 2.0.22 [\#944](https://github.com/kube-HPC/hkube/pull/944) ([hkube-ci](https://github.com/hkube-ci))
- add option to use \_auth instead of \_authToken in npmrc [\#940](https://github.com/kube-HPC/hkube/pull/940) ([yehiyam](https://github.com/yehiyam))
- add imagePullSecret [\#938](https://github.com/kube-HPC/hkube/pull/938) ([yehiyam](https://github.com/yehiyam))
- update python wrapper in builder to version 2.0.21 [\#939](https://github.com/kube-HPC/hkube/pull/939) ([hkube-ci](https://github.com/hkube-ci))
- feat: improve apply function [\#937](https://github.com/kube-HPC/hkube/pull/937) ([NassiHarel](https://github.com/NassiHarel))
- update python wrapper in builder to version 2.0.20 [\#936](https://github.com/kube-HPC/hkube/pull/936) ([hkube-ci](https://github.com/hkube-ci))
- feat: algorithm apply [\#931](https://github.com/kube-HPC/hkube/pull/931) ([NassiHarel](https://github.com/NassiHarel))
- Download pipeline and task results [\#930](https://github.com/kube-HPC/hkube/pull/930) ([NassiHarel](https://github.com/NassiHarel))
- update python wrapper in builder to version 2.0.19 [\#935](https://github.com/kube-HPC/hkube/pull/935) ([hkube-ci](https://github.com/hkube-ci))
- feat: improve cache-pipeline [\#929](https://github.com/kube-HPC/hkube/pull/929) ([NassiHarel](https://github.com/NassiHarel))
- update python wrapper in builder to version 2.0.18 [\#934](https://github.com/kube-HPC/hkube/pull/934) ([hkube-ci](https://github.com/hkube-ci))
- change job name guid to 5 chars [\#933](https://github.com/kube-HPC/hkube/pull/933) ([yehiyam](https://github.com/yehiyam))
- update python wrapper in builder to version 2.0.17 [\#926](https://github.com/kube-HPC/hkube/pull/926) ([hkube-ci](https://github.com/hkube-ci))
- feat: handle algorithm serving state [\#923](https://github.com/kube-HPC/hkube/pull/923) ([NassiHarel](https://github.com/NassiHarel))
- update python wrapper in builder to version 2.0.15 [\#918](https://github.com/kube-HPC/hkube/pull/918) ([hkube-ci](https://github.com/hkube-ci))
- fix result of subpipeline to algorithm [\#914](https://github.com/kube-HPC/hkube/pull/914) ([yehiyam](https://github.com/yehiyam))
- handle large queue size when persisting to redis [\#907](https://github.com/kube-HPC/hkube/pull/907) ([yehiyam](https://github.com/yehiyam))
- update python wrapper in builder to version 2.0.12 [\#909](https://github.com/kube-HPC/hkube/pull/909) ([hkube-ci](https://github.com/hkube-ci))
- update python wrapper in builder to version 2.0.9 [\#901](https://github.com/kube-HPC/hkube/pull/901) ([hkube-ci](https://github.com/hkube-ci))
- Pipeline-driver recovery [\#900](https://github.com/kube-HPC/hkube/pull/900) ([yehiyam](https://github.com/yehiyam))
- update nodejs wrapper to 2.0.17 [\#899](https://github.com/kube-HPC/hkube/pull/899) ([hkube-ci](https://github.com/hkube-ci))
- feat: improve progress, prepare for streaming [\#898](https://github.com/kube-HPC/hkube/pull/898) ([NassiHarel](https://github.com/NassiHarel))
- update etcd package [\#896](https://github.com/kube-HPC/hkube/pull/896) ([yehiyam](https://github.com/yehiyam))
- update nodejs wrapper to 2.0.16 [\#897](https://github.com/kube-HPC/hkube/pull/897) ([hkube-ci](https://github.com/hkube-ci))
- update python wrapper in builder to version 2.0.8 [\#895](https://github.com/kube-HPC/hkube/pull/895) ([hkube-ci](https://github.com/hkube-ci))
- update nodejs wrapper to 2.0.15 [\#891](https://github.com/kube-HPC/hkube/pull/891) ([hkube-ci](https://github.com/hkube-ci))
- feat: split test files in PD, for simpler V2 merging in the future [\#888](https://github.com/kube-HPC/hkube/pull/888) ([NassiHarel](https://github.com/NassiHarel))
- update nodejs wrapper to 2.0.14 [\#882](https://github.com/kube-HPC/hkube/pull/882) ([hkube-ci](https://github.com/hkube-ci))
- feat: seperate api validator to files [\#884](https://github.com/kube-HPC/hkube/pull/884) ([NassiHarel](https://github.com/NassiHarel))
- Jaeger openshift [\#883](https://github.com/kube-HPC/hkube/pull/883) ([yehiyam](https://github.com/yehiyam))
- fix: remove uuid dependency, replace with @hkube/uid [\#879](https://github.com/kube-HPC/hkube/pull/879) ([NassiHarel](https://github.com/NassiHarel))
- Tensorboard namespace [\#878](https://github.com/kube-HPC/hkube/pull/878) ([yehiyam](https://github.com/yehiyam))
- feat: reduce round-trips to Etcd and Redis [\#875](https://github.com/kube-HPC/hkube/pull/875) ([NassiHarel](https://github.com/NassiHarel))
- update nodejs wrapper to 2.0.13 [\#874](https://github.com/kube-HPC/hkube/pull/874) ([hkube-ci](https://github.com/hkube-ci))

## [v1.2.186](https://github.com/kube-HPC/hkube/tree/v1.2.186) (2020-04-30)

**Implemented enhancements:**
- Max concurrent pipelines [\#741](https://github.com/kube-HPC/hkube/pull/741) ([NassiHarel](https://github.com/NassiHarel))
- Tensorboard [\#652](https://github.com/kube-HPC/hkube/issues/652)

**Fixed bugs:**

- Fail algorithm build need to remove the Stop button [\#774](https://github.com/kube-HPC/hkube/issues/774)
- Build algorithm fail from time to time [\#769](https://github.com/kube-HPC/hkube/issues/769)
- Partial gpu support [\#772](https://github.com/kube-HPC/hkube/pull/772) ([yehiyam](https://github.com/yehiyam))
- Allow user to set node graph direction [\#642](https://github.com/kube-HPC/hkube/issues/642)
- triggered pipeline input data [\#756](https://github.com/kube-HPC/hkube/issues/756)
- cron pipeline priority default overwrite the stored [\#754](https://github.com/kube-HPC/hkube/issues/754)
- GUI - create pipeline need to change the concurrent Pipelines to object [\#742](https://github.com/kube-HPC/hkube/issues/742)
- Download  pipeline result file contain  binary data [\#734](https://github.com/kube-HPC/hkube/issues/734)
- build algorithm from github long name  [\#713](https://github.com/kube-HPC/hkube/issues/713)
- Code API  "Node information" does not displayed  [\#625](https://github.com/kube-HPC/hkube/issues/625)
- Fail to execute sub-pipline [\#735](https://github.com/kube-HPC/hkube/issues/735)
- inconsistent flowInput validation [\#725](https://github.com/kube-HPC/hkube/issues/725)
- workers of a batch in a failed pipeline still running [\#638](https://github.com/kube-HPC/hkube/issues/638)
- No errors in dashboard when triggers fail [\#739](https://github.com/kube-HPC/hkube/issues/739)
- disable Hkube metadata [\#728](https://github.com/kube-HPC/hkube/issues/728)
- resume multiple batch pipeline  [\#719](https://github.com/kube-HPC/hkube/issues/719)
- pipeline execution input overwritten by pipeline original inut [\#716](https://github.com/kube-HPC/hkube/issues/716)
- github private  repository need to add username  [\#715](https://github.com/kube-HPC/hkube/issues/715)
- Github branch does not create new build [\#714](https://github.com/kube-HPC/hkube/issues/714)
- No taskId on refreshing node's logs. [\#702](https://github.com/kube-HPC/hkube/issues/702)
- pre schedule of algorithm that timed out and exited with non 0 code  [\#639](https://github.com/kube-HPC/hkube/issues/639)
- Can't get result's indexed item [\#662](https://github.com/kube-HPC/hkube/issues/662)
- tensors board [\#687](https://github.com/kube-HPC/hkube/issues/687)
- Configure pipeline to call other pipeline\(or sub pipe line\) [\#605](https://github.com/kube-HPC/hkube/issues/605)
- Allow user to specify different npm repository for builds [\#387](https://github.com/kube-HPC/hkube/issues/387)
- Error applying algorithm defined from github [\#699](https://github.com/kube-HPC/hkube/issues/699)
- invalid task status exit [\#710](https://github.com/kube-HPC/hkube/issues/710)
- algorithm-builder ignores baseImage property in git mode [\#695](https://github.com/kube-HPC/hkube/issues/695)
- No pipeline stats after experiments feature [\#693](https://github.com/kube-HPC/hkube/issues/693)
- Add Trigger type to pipelines Types [\#691](https://github.com/kube-HPC/hkube/issues/691)
- Logs fetched twice [\#689](https://github.com/kube-HPC/hkube/issues/689)
- add form data to components in the UI [\#582](https://github.com/kube-HPC/hkube/issues/582)


## [v1.2.132](https://github.com/kube-HPC/hkube/tree/v1.2.132) (2020-01-28)

**Fixed bugs:**

- subpipeline not shown in dashboard \(no experiment prefix\) [\#680](https://github.com/kube-HPC/hkube/issues/680)
- Graph nodes color is sometimes wrong [\#657](https://github.com/kube-HPC/hkube/issues/657)

**Implemented enhancements:**

- Support using arbitrary base images [\#563](https://github.com/kube-HPC/hkube/issues/563)

**Fixed bugs:**

- Batch  on Batch [\#676](https://github.com/kube-HPC/hkube/issues/676)
- Algorithm retry overwrite batchTolerance [\#674](https://github.com/kube-HPC/hkube/issues/674)
-  git webhook creates an empty version which cause wired behaviors [\#607](https://github.com/kube-HPC/hkube/issues/607)
- Nodes in pipeline graph are rendered in wrong order [\#358](https://github.com/kube-HPC/hkube/issues/358)
- workers dont get aborted when there is a requirement for another algorithm [\#201](https://github.com/kube-HPC/hkube/issues/201)

**Closed issues:**

- Missing option for complete pipeline result including non-final nodes [\#673](https://github.com/kube-HPC/hkube/issues/673)
- Add TTL for each Algorithm [\#601](https://github.com/kube-HPC/hkube/issues/601)
- Allow defining TTL in Algorithm/Node level [\#342](https://github.com/kube-HPC/hkube/issues/342)

## [v1.2.127](https://github.com/kube-HPC/hkube/tree/v1.2.127) (2020-01-23)

**Closed issues:**

- Run algorithm without creating pipeline for it [\#647](https://github.com/kube-HPC/hkube/issues/647)
- Algorithm retry [\#602](https://github.com/kube-HPC/hkube/issues/602)

## [v1.2.109](https://github.com/kube-HPC/hkube/tree/v1.2.109) (2020-01-16)

**Fixed bugs:**

- Algorithm version window display other algorithms version of similar algorithm names [\#624](https://github.com/kube-HPC/hkube/issues/624)
- input for an algorithm after skipped node [\#583](https://github.com/kube-HPC/hkube/issues/583)

**Closed issues:**

- copy worker ID to clipboard - from Node Information form [\#598](https://github.com/kube-HPC/hkube/issues/598)

## [v1.2.108](https://github.com/kube-HPC/hkube/tree/v1.2.108) (2020-01-15)

**Closed issues:**

- ParentID for each Algorithm- feature request [\#597](https://github.com/kube-HPC/hkube/issues/597)

## [v1.2.107](https://github.com/kube-HPC/hkube/tree/v1.2.107) (2020-01-14)

**Implemented enhancements:**

- Need to update the storage-cleaner [\#568](https://github.com/kube-HPC/hkube/issues/568)

**Fixed bugs:**

- no error message when trying to run non existing algorithm or pipeline with code api [\#510](https://github.com/kube-HPC/hkube/issues/510)

**Closed issues:**

- Delete related data after algorithm deletion [\#627](https://github.com/kube-HPC/hkube/issues/627)
- Cache storage data in worker [\#576](https://github.com/kube-HPC/hkube/issues/576)
- add simple API for storage [\#554](https://github.com/kube-HPC/hkube/issues/554)
- Add Graph API & Improve the pipeline graph [\#545](https://github.com/kube-HPC/hkube/issues/545)
- Expose API for gitlab and github webhook upon push [\#518](https://github.com/kube-HPC/hkube/issues/518)
- Expose through UI, building algorithm from code in git   [\#517](https://github.com/kube-HPC/hkube/issues/517)
- Add pause/resume pipeline [\#344](https://github.com/kube-HPC/hkube/issues/344)
- Code API: execute command for creating dyanmic algorithm from worker [\#190](https://github.com/kube-HPC/hkube/issues/190)

## [v1.2.103](https://github.com/kube-HPC/hkube/tree/v1.2.103) (2020-01-13)

**Fixed bugs:**

- Stop pipeline while running "results" status is completed [\#620](https://github.com/kube-HPC/hkube/issues/620)
- Algorithm with non-exist image [\#500](https://github.com/kube-HPC/hkube/issues/500)
- rerun pipeline from cached pipeline [\#326](https://github.com/kube-HPC/hkube/issues/326)

**Closed issues:**

- Dashboard API to change the logger verbosity level [\#609](https://github.com/kube-HPC/hkube/issues/609)
- We should add metrics and scores to algorithms [\#592](https://github.com/kube-HPC/hkube/issues/592)
- Put result to storage [\#580](https://github.com/kube-HPC/hkube/issues/580)
- invalid task status exit [\#548](https://github.com/kube-HPC/hkube/issues/548)

## [v1.2.96](https://github.com/kube-HPC/hkube/tree/v1.2.96) (2020-01-05)

**Fixed bugs:**

- Update algorithm version while running force = false [\#648](https://github.com/kube-HPC/hkube/issues/648)

## [v1.2.92](https://github.com/kube-HPC/hkube/tree/v1.2.92) (2020-01-02)

**Implemented enhancements:**

- Github issues cleanup [\#396](https://github.com/kube-HPC/hkube/issues/396)

## [v1.2.79](https://github.com/kube-HPC/hkube/tree/v1.2.79) (2019-12-25)

**Implemented enhancements:**

- Create package for removing duplicate code [\#573](https://github.com/kube-HPC/hkube/issues/573)

**Closed issues:**

- There is no info on batch errors [\#284](https://github.com/kube-HPC/hkube/issues/284)

## [v1.2.77](https://github.com/kube-HPC/hkube/tree/v1.2.77) (2019-12-24)

**Closed issues:**

- Need to think about common code between pipeline-driver and algorithm queue [\#166](https://github.com/kube-HPC/hkube/issues/166)

## [v1.2.76](https://github.com/kube-HPC/hkube/tree/v1.2.76) (2019-12-24)

**Fixed bugs:**

- batch tasks are not canceled when pipeline fails [\#578](https://github.com/kube-HPC/hkube/issues/578)
- Jobs cleaner not working [\#532](https://github.com/kube-HPC/hkube/issues/532)
- not constant execId and pipleineId types in the worker on outgoing messages [\#521](https://github.com/kube-HPC/hkube/issues/521)
- Batch errors are not visible [\#366](https://github.com/kube-HPC/hkube/issues/366)
- algorithm queue writes CrashLoopBackOff every 15 seconds [\#239](https://github.com/kube-HPC/hkube/issues/239)
- Queue cant accept new job after job arrived with state stop [\#225](https://github.com/kube-HPC/hkube/issues/225)

**Closed issues:**

- Remove prefix raw- for raw pipeline [\#615](https://github.com/kube-HPC/hkube/issues/615)
- Add property "Tags" & "Types" for each pipeline execution [\#614](https://github.com/kube-HPC/hkube/issues/614)
- Split tests into files [\#520](https://github.com/kube-HPC/hkube/issues/520)
- Recovery after deploy [\#512](https://github.com/kube-HPC/hkube/issues/512)
- Versioning for algorithms. [\#487](https://github.com/kube-HPC/hkube/issues/487)
- Merge state with status [\#422](https://github.com/kube-HPC/hkube/issues/422)
- we should replace our wrapping implementation for algorithms to work as a package  [\#347](https://github.com/kube-HPC/hkube/issues/347)
- Running time for each algorithm [\#292](https://github.com/kube-HPC/hkube/issues/292)
- algorithm builder: features implementation [\#289](https://github.com/kube-HPC/hkube/issues/289)
- Nodes and pipeline results [\#287](https://github.com/kube-HPC/hkube/issues/287)
- Task Executor Features [\#270](https://github.com/kube-HPC/hkube/issues/270)

## [v1.2.72](https://github.com/kube-HPC/hkube/tree/v1.2.72) (2019-12-17)

**Closed issues:**

- Algorithm name length issue [\#259](https://github.com/kube-HPC/hkube/issues/259)

## [v1.2.66](https://github.com/kube-HPC/hkube/tree/v1.2.66) (2019-12-16)

**Fixed bugs:**

- ENAMETOOLONG: name too long - due to subpipe of subpipe [\#562](https://github.com/kube-HPC/hkube/issues/562)
- Cannot run new algorithm after image update [\#509](https://github.com/kube-HPC/hkube/issues/509)

**Closed issues:**

- Update algorithm name [\#530](https://github.com/kube-HPC/hkube/issues/530)
- Allow stopping a worker from UI [\#321](https://github.com/kube-HPC/hkube/issues/321)
- Create hkube flow story with blog [\#306](https://github.com/kube-HPC/hkube/issues/306)
- Download source code [\#302](https://github.com/kube-HPC/hkube/issues/302)
- Large CPU algorithm will not be scheduled [\#233](https://github.com/kube-HPC/hkube/issues/233)
- When stopping pipeline need to clear data from etcd [\#200](https://github.com/kube-HPC/hkube/issues/200)

## [v1.2.63](https://github.com/kube-HPC/hkube/tree/v1.2.63) (2019-12-12)

**Fixed bugs:**

- algorithm image name: "must not have leading or trailing whitespace" [\#581](https://github.com/kube-HPC/hkube/issues/581)

**Closed issues:**

- Fix the clean job api [\#569](https://github.com/kube-HPC/hkube/issues/569)

## [v1.2.62](https://github.com/kube-HPC/hkube/tree/v1.2.62) (2019-12-12)

**Closed issues:**

- Improve the dashboard [\#544](https://github.com/kube-HPC/hkube/issues/544)

## [v1.2.60](https://github.com/kube-HPC/hkube/tree/v1.2.60) (2019-12-11)

**Closed issues:**

- insert to storage on result [\#571](https://github.com/kube-HPC/hkube/issues/571)

## [v1.2.58](https://github.com/kube-HPC/hkube/tree/v1.2.58) (2019-12-08)

**Closed issues:**

- Add Event entity [\#234](https://github.com/kube-HPC/hkube/issues/234)

## [v1.2.57](https://github.com/kube-HPC/hkube/tree/v1.2.57) (2019-12-02)

**Fixed bugs:**

- algorithm versions list is copied to all open algorithms [\#593](https://github.com/kube-HPC/hkube/issues/593)

**Closed issues:**

- move examples/algorithm-example-python/ to ----\> own repository [\#408](https://github.com/kube-HPC/hkube/issues/408)

## [v1.2.56](https://github.com/kube-HPC/hkube/tree/v1.2.56) (2019-11-27)

**Implemented enhancements:**

- Direct call from dashboard to API-Server [\#570](https://github.com/kube-HPC/hkube/issues/570)

## [v1.2.44](https://github.com/kube-HPC/hkube/tree/v1.2.44) (2019-11-10)

**Closed issues:**

- Move to husky? [\#483](https://github.com/kube-HPC/hkube/issues/483)

## [v1.2.26](https://github.com/kube-HPC/hkube/tree/v1.2.26) (2019-10-28)

**Fixed bugs:**

- cannot stop code-api algorithm [\#501](https://github.com/kube-HPC/hkube/issues/501)
- out of memory in the pipeline driver [\#490](https://github.com/kube-HPC/hkube/issues/490)
- debug worker [\#431](https://github.com/kube-HPC/hkube/issues/431)
- Image Pull Backof [\#224](https://github.com/kube-HPC/hkube/issues/224)

**Closed issues:**

- check the bull removeOnFail [\#467](https://github.com/kube-HPC/hkube/issues/467)
- Preschedule: run child node before completion. [\#454](https://github.com/kube-HPC/hkube/issues/454)
- Moving to docker in docker instead of using machine's docker [\#368](https://github.com/kube-HPC/hkube/issues/368)
- Add option for algorithms to execute another algorithms using API [\#288](https://github.com/kube-HPC/hkube/issues/288)
- Update doc on hkube.io [\#191](https://github.com/kube-HPC/hkube/issues/191)

## [v1.2.11](https://github.com/kube-HPC/hkube/tree/v1.2.11) (2019-10-03)

**Implemented enhancements:**

- Change the way jobs are scheduled [\#232](https://github.com/kube-HPC/hkube/issues/232)

**Fixed bugs:**

- no loading screen [\#495](https://github.com/kube-HPC/hkube/issues/495)

**Closed issues:**

- send last pipeline result to algorithm [\#269](https://github.com/kube-HPC/hkube/issues/269)
- create timer for bootstrap on algorithm [\#241](https://github.com/kube-HPC/hkube/issues/241)
- Check high availability of K8s masters [\#217](https://github.com/kube-HPC/hkube/issues/217)
- Reduce intervals for resource-manager and task-executor [\#205](https://github.com/kube-HPC/hkube/issues/205)

## [v1.2.9](https://github.com/kube-HPC/hkube/tree/v1.2.9) (2019-09-19)

**Fixed bugs:**

- inconsistent datatypes return on code api execId and pipelineId  [\#502](https://github.com/kube-HPC/hkube/issues/502)

## [v1.2.2](https://github.com/kube-HPC/hkube/tree/v1.2.2) (2019-09-04)

**Implemented enhancements:**

- Rewrite etcd.hkube [\#184](https://github.com/kube-HPC/hkube/issues/184)

**Fixed bugs:**

- pipeline driver fails and go to recovering mode and no other driver takes the job [\#469](https://github.com/kube-HPC/hkube/issues/469)
- turning on a cron job for a pipeline [\#442](https://github.com/kube-HPC/hkube/issues/442)
- race condition in dashboard [\#430](https://github.com/kube-HPC/hkube/issues/430)
- create a hot worker and than delete it [\#278](https://github.com/kube-HPC/hkube/issues/278)

## [v1.1.1084](https://github.com/kube-HPC/hkube/tree/v1.1.1084) (2019-08-28)

**Fixed bugs:**

- Algorithm readme not updating [\#423](https://github.com/kube-HPC/hkube/issues/423)

## [v1.1.1081](https://github.com/kube-HPC/hkube/tree/v1.1.1081) (2019-08-26)

**Fixed bugs:**

- download pipeline results dosent work [\#468](https://github.com/kube-HPC/hkube/issues/468)
- stalled job [\#463](https://github.com/kube-HPC/hkube/issues/463)
- ui crashes if you click on a view before the data was loaded [\#460](https://github.com/kube-HPC/hkube/issues/460)
- sub pipeline from the algorunner dosent work [\#458](https://github.com/kube-HPC/hkube/issues/458)
- cpu usage when adding an algorithm [\#444](https://github.com/kube-HPC/hkube/issues/444)
- node input output details doesn't show [\#441](https://github.com/kube-HPC/hkube/issues/441)
- pipeline description [\#405](https://github.com/kube-HPC/hkube/issues/405)
- worker page pod additional details [\#402](https://github.com/kube-HPC/hkube/issues/402)
- deleting the pipeline-driver-queue when executing a new pipeline [\#290](https://github.com/kube-HPC/hkube/issues/290)

**Closed issues:**

- Refactor Graph [\#478](https://github.com/kube-HPC/hkube/issues/478)
- Add Dashboard Routing [\#451](https://github.com/kube-HPC/hkube/issues/451)
- Swagger split into files [\#298](https://github.com/kube-HPC/hkube/issues/298)

## [v1.1.1080](https://github.com/kube-HPC/hkube/tree/v1.1.1080) (2019-08-21)

**Closed issues:**

- we should verify that checksum operation for algorithm build is not heavy  [\#488](https://github.com/kube-HPC/hkube/issues/488)

## [v1.1.1072](https://github.com/kube-HPC/hkube/tree/v1.1.1072) (2019-08-18)

**Closed issues:**

- Loading Screen [\#395](https://github.com/kube-HPC/hkube/issues/395)
- Infinity Table [\#394](https://github.com/kube-HPC/hkube/issues/394)

## [v1.1.1068](https://github.com/kube-HPC/hkube/tree/v1.1.1068) (2019-08-13)

**Fixed bugs:**

- dashboard crashes  [\#473](https://github.com/kube-HPC/hkube/issues/473)

**Closed issues:**

- Add watch for stop build [\#453](https://github.com/kube-HPC/hkube/issues/453)

## [v1.1.1061](https://github.com/kube-HPC/hkube/tree/v1.1.1061) (2019-08-07)

**Fixed bugs:**

- building a node algorith, dosent work [\#457](https://github.com/kube-HPC/hkube/issues/457)

## [v1.1.1058](https://github.com/kube-HPC/hkube/tree/v1.1.1058) (2019-08-07)

**Fixed bugs:**

- building a node algorithm [\#464](https://github.com/kube-HPC/hkube/issues/464)

## [v1.1.1046](https://github.com/kube-HPC/hkube/tree/v1.1.1046) (2019-08-04)

**Fixed bugs:**

- Stop algorithm build [\#452](https://github.com/kube-HPC/hkube/issues/452)

## [v1.1.1037](https://github.com/kube-HPC/hkube/tree/v1.1.1037) (2019-07-30)

**Fixed bugs:**

- pipelines page [\#443](https://github.com/kube-HPC/hkube/issues/443)

## [v1.1.1033](https://github.com/kube-HPC/hkube/tree/v1.1.1033) (2019-07-30)

**Fixed bugs:**

- set ingress permission in cleaner role [\#432](https://github.com/kube-HPC/hkube/issues/432)

## [v1.1.1031](https://github.com/kube-HPC/hkube/tree/v1.1.1031) (2019-07-29)

**Fixed bugs:**

- all pages "show number of rows in a table" [\#407](https://github.com/kube-HPC/hkube/issues/407)

## [v1.1.1030](https://github.com/kube-HPC/hkube/tree/v1.1.1030) (2019-07-28)

**Fixed bugs:**

- fix docker image parsing [\#433](https://github.com/kube-HPC/hkube/issues/433)
- edit description. both on pipelines and algorithms [\#404](https://github.com/kube-HPC/hkube/issues/404)
- drivers page- sort [\#403](https://github.com/kube-HPC/hkube/issues/403)


## [v1.1.1022](https://github.com/kube-HPC/hkube/tree/v1.1.1022) (2019-07-17)

**Fixed bugs:**

- Store Algorithm Readme [\#393](https://github.com/kube-HPC/hkube/issues/393)
- python automated build ignores exceptions on ws.send [\#383](https://github.com/kube-HPC/hkube/issues/383)
- Fix auto complete [\#382](https://github.com/kube-HPC/hkube/issues/382)
- add new algorithm from build [\#308](https://github.com/kube-HPC/hkube/issues/308)

**Closed issues:**

- stalled in node lead to failed pipeline [\#412](https://github.com/kube-HPC/hkube/issues/412)
- json parser for algorithm from build [\#309](https://github.com/kube-HPC/hkube/issues/309)
- Pipeline Driver not deleting /jobs/tasks/\<JobId\> [\#277](https://github.com/kube-HPC/hkube/issues/277)

## [v1.1.1021](https://github.com/kube-HPC/hkube/tree/v1.1.1021) (2019-07-08)

**Closed issues:**

- Suggestions [\#279](https://github.com/kube-HPC/hkube/issues/279)

## [v1.1.1016](https://github.com/kube-HPC/hkube/tree/v1.1.1016) (2019-06-30)

**Closed issues:**

- update base image tag automatically [\#399](https://github.com/kube-HPC/hkube/issues/399)

## [v1.1.1015](https://github.com/kube-HPC/hkube/tree/v1.1.1015) (2019-06-30)

**Fixed bugs:**

- add/edit algorithm description [\#406](https://github.com/kube-HPC/hkube/issues/406)
- input output details on a worker [\#401](https://github.com/kube-HPC/hkube/issues/401)
- view pod logs form the workers tab [\#336](https://github.com/kube-HPC/hkube/issues/336)
- the UI is very slow [\#333](https://github.com/kube-HPC/hkube/issues/333)
- pipelines page- show pipeline details [\#327](https://github.com/kube-HPC/hkube/issues/327)

## [v1.1.1014](https://github.com/kube-HPC/hkube/tree/v1.1.1014) (2019-06-30)

**Fixed bugs:**

- Fix API CLI documentation [\#369](https://github.com/kube-HPC/hkube/issues/369)

## [v1.1.1010](https://github.com/kube-HPC/hkube/tree/v1.1.1010) (2019-06-25)

**Fixed bugs:**

- post request endpoints are not correct [\#337](https://github.com/kube-HPC/hkube/issues/337)
- update algorithm [\#335](https://github.com/kube-HPC/hkube/issues/335)
- running pipeline with input [\#332](https://github.com/kube-HPC/hkube/issues/332)
- creating a pipeline with the wizard  [\#331](https://github.com/kube-HPC/hkube/issues/331)
- filter the jobs table by some key then run "simple" pipeline- ui craches [\#329](https://github.com/kube-HPC/hkube/issues/329)

## [v1.1.1009](https://github.com/kube-HPC/hkube/tree/v1.1.1009) (2019-06-24)

**Merged pull requests:**

- support kaniko builds [\#389](https://github.com/kube-HPC/hkube/pull/389) ([yehiyam](https://github.com/yehiyam))

## [v1.1.1007](https://github.com/kube-HPC/hkube/tree/v1.1.1007) (2019-06-23)

**Closed issues:**

- Restore missing features [\#381](https://github.com/kube-HPC/hkube/issues/381)

## [v1.1.1003](https://github.com/kube-HPC/hkube/tree/v1.1.1003) (2019-06-19)

**Merged pull requests:**

- Add issue templates [\#363](https://github.com/kube-HPC/hkube/pull/363) ([denvash](https://github.com/denvash))
- Create CODE\_OF\_CONDUCT.md [\#361](https://github.com/kube-HPC/hkube/pull/361) ([NassiHarel](https://github.com/NassiHarel))

## [v1.1.1001](https://github.com/kube-HPC/hkube/tree/v1.1.1001) (2019-06-18)

**Fixed bugs:**

- workers page open pod details crashes the page [\#334](https://github.com/kube-HPC/hkube/issues/334)
- create pipeline in the ui doesn't show nodes to the pipeline json [\#330](https://github.com/kube-HPC/hkube/issues/330)
- jobs page - Unnecessary filter icon at the Pipeline status column [\#328](https://github.com/kube-HPC/hkube/issues/328)
- Fix issue with pipeline rerun [\#312](https://github.com/kube-HPC/hkube/issues/312)

**Closed issues:**

- Switch to WS as default [\#325](https://github.com/kube-HPC/hkube/issues/325)
- Add memory human readable property [\#311](https://github.com/kube-HPC/hkube/issues/311)
- Dashboard Refactor [\#310](https://github.com/kube-HPC/hkube/issues/310)
- Fix issues with env: entry-point and worker-protocol for debug  [\#307](https://github.com/kube-HPC/hkube/issues/307)
- reduce node\_modules size when building docker by: npm i --production [\#285](https://github.com/kube-HPC/hkube/issues/285)

**Merged pull requests:**

- Update README.md [\#353](https://github.com/kube-HPC/hkube/pull/353) ([denvash](https://github.com/denvash))

## [v1.1.1](https://github.com/kube-HPC/hkube/tree/v1.1.1) (2019-06-04)

**Implemented enhancements:**

- Add a tool-tip to icons in main menu bar when menu is collapsed [\#315](https://github.com/kube-HPC/hkube/issues/315)
- Move to Node v10 [\#210](https://github.com/kube-HPC/hkube/issues/210)
- Add rate-limiter to api-server [\#21](https://github.com/kube-HPC/hkube/issues/21)

**Fixed bugs:**

- Problem in selected Algorithm logs tab, in pipeline graph view. [\#313](https://github.com/kube-HPC/hkube/issues/313)
- worker that got a stopped job dosent clear well [\#296](https://github.com/kube-HPC/hkube/issues/296)
- simulator get stuck only monitor server restart helps for not long [\#295](https://github.com/kube-HPC/hkube/issues/295)
- error key in json was added even when no error is the pipeline [\#286](https://github.com/kube-HPC/hkube/issues/286)
- trigger service will not exit if unable to reconnect to ETCD  [\#275](https://github.com/kube-HPC/hkube/issues/275)
- pipeline should report finish only if result was successfully saved to storage and not before. [\#257](https://github.com/kube-HPC/hkube/issues/257)
- driver should report error if process failed due to memory usage more than 256MB [\#256](https://github.com/kube-HPC/hkube/issues/256)
- reconciler should kill redundant pipeline-drivers if defined less than actual running drivers [\#255](https://github.com/kube-HPC/hkube/issues/255)
- a pipeline that worked stopped working and fails after crashLoopBackOff [\#243](https://github.com/kube-HPC/hkube/issues/243)
- add empty LocationConstraint \(production bug\) [\#240](https://github.com/kube-HPC/hkube/issues/240)
- CrashLoopBackOff when algorithm exit and pipeline stopped [\#238](https://github.com/kube-HPC/hkube/issues/238)
- sometimes storgeInfo not exists [\#237](https://github.com/kube-HPC/hkube/issues/237)
- delete algorithm after all pipelines completed and pipeline was deleted is not working [\#235](https://github.com/kube-HPC/hkube/issues/235)
- task executor sometimes request for double the workers it really needs [\#227](https://github.com/kube-HPC/hkube/issues/227)
- resource allocation for a pod is not as described  [\#220](https://github.com/kube-HPC/hkube/issues/220)
- failed to start pipeline if "input" was missing from pipeline descriptor [\#216](https://github.com/kube-HPC/hkube/issues/216)
- last algorithm in a batch is taking to much time to complete [\#215](https://github.com/kube-HPC/hkube/issues/215)
- ttl reason for exparation time should be in a real time not epoch [\#212](https://github.com/kube-HPC/hkube/issues/212)
- override stored pipeline options [\#209](https://github.com/kube-HPC/hkube/issues/209)
- algorithm operator stuck when etcd is failed to connect [\#206](https://github.com/kube-HPC/hkube/issues/206)
-  unable to find handler for job [\#204](https://github.com/kube-HPC/hkube/issues/204)
- transition is invalid in current state [\#203](https://github.com/kube-HPC/hkube/issues/203)
- Cannot read property 'filter' of undefined [\#202](https://github.com/kube-HPC/hkube/issues/202)
- Pipeline that failed get stopped status instead of failed [\#198](https://github.com/kube-HPC/hkube/issues/198)
- delete an algorithm is not possible [\#197](https://github.com/kube-HPC/hkube/issues/197)
- resource manager request more resources than aviliable [\#196](https://github.com/kube-HPC/hkube/issues/196)
- algorithm that failed and threw an error stays up in the system and not getting cleaned/deleted  [\#193](https://github.com/kube-HPC/hkube/issues/193)
- stop pipeline doesn't work [\#192](https://github.com/kube-HPC/hkube/issues/192)
- algorithm queue scores was not ordered when new job added during scoring update [\#188](https://github.com/kube-HPC/hkube/issues/188)
- wait any return wrong number of results.  [\#187](https://github.com/kube-HPC/hkube/issues/187)
- failed algorithm return null response in the results [\#177](https://github.com/kube-HPC/hkube/issues/177)
- execute a request and immediately stop it, the request remain in status "sttoping" [\#175](https://github.com/kube-HPC/hkube/issues/175)
- Make triggers pipeline work the other way [\#173](https://github.com/kube-HPC/hkube/issues/173)
- pipeline result is null/empty [\#167](https://github.com/kube-HPC/hkube/issues/167)
- Fix AlgorithmQueue active count [\#163](https://github.com/kube-HPC/hkube/issues/163)
- logs from the algorithm are sometimes dont written to the elastic search logs [\#148](https://github.com/kube-HPC/hkube/issues/148)
- pod stopped working, show an error that need to be tracked [\#147](https://github.com/kube-HPC/hkube/issues/147)
- max retries of an algorithm should fail the pipeline [\#146](https://github.com/kube-HPC/hkube/issues/146)
- large batch size doesnt run [\#144](https://github.com/kube-HPC/hkube/issues/144)
- Etcd periodic cleaner [\#142](https://github.com/kube-HPC/hkube/issues/142)
- Pipeline request using pipeline which isn't stored in the repository of pipeline descriptors [\#43](https://github.com/kube-HPC/hkube/issues/43)
- When stopping pipeline while worker is init [\#40](https://github.com/kube-HPC/hkube/issues/40)
- worker tries to fetch null data from storage provider [\#39](https://github.com/kube-HPC/hkube/issues/39)
- Run batch on node results not working due to new storage feature [\#38](https://github.com/kube-HPC/hkube/issues/38)
- apak algo dont deal with stop [\#26](https://github.com/kube-HPC/hkube/issues/26)
- when stopping an apak pipeline the amount of watchers is increasing  [\#25](https://github.com/kube-HPC/hkube/issues/25)
- exec stored with a large amount of rows in the body of the request returns a 413 error "payload to large" [\#20](https://github.com/kube-HPC/hkube/issues/20)
- batch tolerance 0% sets the default to 80 [\#19](https://github.com/kube-HPC/hkube/issues/19)
- inconsistency batch tolerance behaviour [\#18](https://github.com/kube-HPC/hkube/issues/18)
- max retry on failing pods should return an error and close pipeline   [\#17](https://github.com/kube-HPC/hkube/issues/17)
- logs are taken very long to be written to ES [\#14](https://github.com/kube-HPC/hkube/issues/14)
- pipelines that sometimes do not end the run \(inconsistent\) [\#13](https://github.com/kube-HPC/hkube/issues/13)
- results of a pipeline comes with a big delay [\#12](https://github.com/kube-HPC/hkube/issues/12)
- pending pipelines that were stopped before starting never being stopped [\#11](https://github.com/kube-HPC/hkube/issues/11)
- get status of a pipeline after some nodes has finished  [\#10](https://github.com/kube-HPC/hkube/issues/10)
- worker crashes after timeout between the worker and the algorithm [\#8](https://github.com/kube-HPC/hkube/issues/8)
- the '0' result or false result are not returned to the api-server [\#5](https://github.com/kube-HPC/hkube/issues/5)
- inconsistent end status received after PL completed [\#2](https://github.com/kube-HPC/hkube/issues/2)

**Closed issues:**

- Clean docker trash after build [\#303](https://github.com/kube-HPC/hkube/issues/303)
- Add stream support in FS storage adapter [\#301](https://github.com/kube-HPC/hkube/issues/301)
- GPU resource management seems to no work well [\#297](https://github.com/kube-HPC/hkube/issues/297)
- bucket name should include cluster name also to be able support multiple clients from different clusters [\#294](https://github.com/kube-HPC/hkube/issues/294)
- Need to re-enter tasks to queue after stalled [\#260](https://github.com/kube-HPC/hkube/issues/260)
- Simplify API for adding algorithm to HKUBE [\#250](https://github.com/kube-HPC/hkube/issues/250)
- Add description field to pipeline [\#245](https://github.com/kube-HPC/hkube/issues/245)
- reduce logs on file watch error [\#244](https://github.com/kube-HPC/hkube/issues/244)
- test issue [\#242](https://github.com/kube-HPC/hkube/issues/242)
- validate exec raw  run without trigger [\#231](https://github.com/kube-HPC/hkube/issues/231)
- resource manager request for more resources the cluster have, it results in workers stuck on pending status and dosent exit alnoe [\#230](https://github.com/kube-HPC/hkube/issues/230)
- batch on empty array not working [\#229](https://github.com/kube-HPC/hkube/issues/229)
- validate deep calls of trigger pipelines not exceed the limitation [\#228](https://github.com/kube-HPC/hkube/issues/228)
- Check why pipeline-driver has retry job [\#222](https://github.com/kube-HPC/hkube/issues/222)
- Insufficient cpu for pipeline drivers [\#219](https://github.com/kube-HPC/hkube/issues/219)
- Check if exec/tree still works [\#211](https://github.com/kube-HPC/hkube/issues/211)
- stop pipeline if expired \#186 \#195 [\#208](https://github.com/kube-HPC/hkube/issues/208)
- unable to create job with capital letter [\#199](https://github.com/kube-HPC/hkube/issues/199)
- Add expiration time [\#195](https://github.com/kube-HPC/hkube/issues/195)
- Add support for /internal/sub-pipelines & /internal/stop [\#194](https://github.com/kube-HPC/hkube/issues/194)
- Review ETCD tree architecture [\#189](https://github.com/kube-HPC/hkube/issues/189)
- Add delete execution after job completed [\#186](https://github.com/kube-HPC/hkube/issues/186)
- Add watch state for all jobs in etcd [\#183](https://github.com/kube-HPC/hkube/issues/183)
- Create common k8s pods npm package [\#182](https://github.com/kube-HPC/hkube/issues/182)
- storage cleaner  [\#181](https://github.com/kube-HPC/hkube/issues/181)
- Implement stop in pipeline-driver-queue [\#180](https://github.com/kube-HPC/hkube/issues/180)
- etcd issues when saving large data [\#179](https://github.com/kube-HPC/hkube/issues/179)
- When pipeline failed, need to send stop to all workers \(batch\) [\#178](https://github.com/kube-HPC/hkube/issues/178)
- change the pipeline name on /exec/raw  [\#176](https://github.com/kube-HPC/hkube/issues/176)
- add validation to pipeline/algorithms name [\#174](https://github.com/kube-HPC/hkube/issues/174)
- add pipelines results stored/raw [\#172](https://github.com/kube-HPC/hkube/issues/172)
- pipeline-driver queue support [\#171](https://github.com/kube-HPC/hkube/issues/171)
- Add prometues cpu metric  [\#169](https://github.com/kube-HPC/hkube/issues/169)
- enternceTime [\#168](https://github.com/kube-HPC/hkube/issues/168)
- Implement stop in algorithm-queue [\#164](https://github.com/kube-HPC/hkube/issues/164)
- When we have triggers of pipelines we get very long jobId which cause error in minio [\#161](https://github.com/kube-HPC/hkube/issues/161)
- Fix pipeline-driver-queue issue [\#160](https://github.com/kube-HPC/hkube/issues/160)
- Change the resource manager to support the pipeline driver queue [\#152](https://github.com/kube-HPC/hkube/issues/152)
- Create pipeline driver queue [\#151](https://github.com/kube-HPC/hkube/issues/151)
- Add pre-commit script to package.json [\#150](https://github.com/kube-HPC/hkube/issues/150)
- Validate `algorithmName` in nodes pipeline and exists in store [\#149](https://github.com/kube-HPC/hkube/issues/149)
- Need to think about required cpu vs actual cpu [\#145](https://github.com/kube-HPC/hkube/issues/145)
- Scale api-server [\#143](https://github.com/kube-HPC/hkube/issues/143)
- Add unit parsing to /algorithms API [\#140](https://github.com/kube-HPC/hkube/issues/140)
- Handle algorithm deletion [\#138](https://github.com/kube-HPC/hkube/issues/138)
- S3 Buckets limit [\#137](https://github.com/kube-HPC/hkube/issues/137)
- Add API for algorithms store [\#136](https://github.com/kube-HPC/hkube/issues/136)
- Katacoda [\#135](https://github.com/kube-HPC/hkube/issues/135)
- Add WS adapter [\#134](https://github.com/kube-HPC/hkube/issues/134)
- ETCD cleanup & storing results on custom storage [\#131](https://github.com/kube-HPC/hkube/issues/131)
- Add trigger tracking [\#130](https://github.com/kube-HPC/hkube/issues/130)
- Landing Page [\#127](https://github.com/kube-HPC/hkube/issues/127)
- api server should strore input in custom storage  [\#126](https://github.com/kube-HPC/hkube/issues/126)
- resource executor meeting  status  [\#125](https://github.com/kube-HPC/hkube/issues/125)
- Resource Allocation [\#124](https://github.com/kube-HPC/hkube/issues/124)
- View statistics of algorithm's pending requests in a graph view [\#112](https://github.com/kube-HPC/hkube/issues/112)
- View statistics of pipeline's pending requests in a graph view [\#104](https://github.com/kube-HPC/hkube/issues/104)
- NFRs Version 100 [\#85](https://github.com/kube-HPC/hkube/issues/85)
- NFRs ver. Beta1 [\#79](https://github.com/kube-HPC/hkube/issues/79)
- Receiving 8 pipeline requests within an hour [\#78](https://github.com/kube-HPC/hkube/issues/78)
- Concurrent execution of 4 pipeline requests [\#77](https://github.com/kube-HPC/hkube/issues/77)
- Pipeline request with a batch of 1,000 algorithms [\#76](https://github.com/kube-HPC/hkube/issues/76)
- HKube execution overheads [\#75](https://github.com/kube-HPC/hkube/issues/75)
- High Availability for algorithm services [\#74](https://github.com/kube-HPC/hkube/issues/74)
- High Availability for HKube infrastructure services - version Beta1 [\#73](https://github.com/kube-HPC/hkube/issues/73)
- Pipelines' execution management [\#66](https://github.com/kube-HPC/hkube/issues/66)
- Retry algorithm execution, if system resource error \(e.g. VM/ Docker failure\) occurred during the algorithm execution [\#65](https://github.com/kube-HPC/hkube/issues/65)
- Cancel pipeline execution, if the maximum retries for execution of failed algorithm exceeded [\#62](https://github.com/kube-HPC/hkube/issues/62)
- production jaeger deployment [\#37](https://github.com/kube-HPC/hkube/issues/37)
- The name of the pipeline will be its identifier [\#35](https://github.com/kube-HPC/hkube/issues/35)
- Part or all of the inputs of algorithm are taken from the pipeline's request \[R3\] \[R6\] [\#34](https://github.com/kube-HPC/hkube/issues/34)
- Batch size is determined by the pipeline's input [\#30](https://github.com/kube-HPC/hkube/issues/30)
- Define algorithms which will be executed in the beginning of the pipeline \[R8\] [\#27](https://github.com/kube-HPC/hkube/issues/27)
- api server should return data instead of custom-storage link [\#24](https://github.com/kube-HPC/hkube/issues/24)
- data to custom storage should support stream   [\#23](https://github.com/kube-HPC/hkube/issues/23)
- stop pipeline sometimes don't work [\#9](https://github.com/kube-HPC/hkube/issues/9)
- validation on flowInput on store pipeline [\#7](https://github.com/kube-HPC/hkube/issues/7)
- results responses comes with jobid object [\#6](https://github.com/kube-HPC/hkube/issues/6)
- cancel completed PL. [\#4](https://github.com/kube-HPC/hkube/issues/4)
- each time a PL is finished, the results api should be updated [\#3](https://github.com/kube-HPC/hkube/issues/3)



\* *This Changelog was automatically generated by [github_changelog_generator](https://github.com/github-changelog-generator/github-changelog-generator)*
