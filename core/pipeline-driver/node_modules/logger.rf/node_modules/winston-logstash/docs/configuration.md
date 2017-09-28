## Configuration

* `host`
    * The host location of the logstash server.
    * Default: `127.0.0.1`
* `port`
    * The host port to connect.
    * Default: `28777`
* `max_connect_retries`
    * Max number of attempts to reconnect to logstash before going into silence.
    * `-1` means retry forever.
    * Default: `4`
* `timeout_connect_retries`
    * The number of ms between each retry for a reconnect to logstash .
    * Default: `100`
* `ssl_enable`
    * Enable SSL transfer of logs to logstash.
    * Default: `false`
* `ssl_key`
    * Path location of client private key.
    * Only needed if SSL verify is required on logstash.
    * No default
* `ssl_cert`
    * Path location of client public certificate.
    * Only needed if SSL verify is required on logstash.
    * No default
* `ssl_passphrase`
    * Passphrase for the SSL key.
    * Only needed if the certificate has a passphrase.
    * No default
* `rejectUnauthorized`
    * If true the server will reject any connection which is not authorized with the list of supplied CAs. 
    * Default true
* `strip_colors`
    * Strip colors from messages and metadata
    * Default: `false`
