
var Repository = require('./repository/redis-repository.js');
var repo = new Repository(config.redis.host, config.redis.port);

repo.keys().then(function(keys) {
	if (keys.length === 0) {
		console.log('No keys to delete!');
		repo.dispose();
		return;
	}

	console.log('Deleting ' + keys.length + ' keys...');
	var deleted = 0;

	for (var i = 0; i < keys.length; ++i) {
		repo.delete(keys[i])
			.then(function() {
				if (++deleted === keys.length) {
					console.log('Done.');
					repo.dispose();
				}
			}).catch(function(reason) {
				console.log('Error while deleting: ' + reason);
				if (++deleted === keys.length) {
					console.log('Done.');
					repo.dispose();
				}
			});
	}
}).catch(function(reason) {
	console.log('Error while retreiving keys: ' + reason);
});
