var _ = require("underscore");

module.exports.name = "not";

module.exports.safe = true;

module.exports.normalize = function(action, normalize_action) {
	if(_.isObject(action) && !!action.not) {
		// TODO - Warning about not honoring on_ events for nested element
		action.not = normalize_action(action.not);
		return action;
	}
}

module.exports.handles = function(action) {
	return _.isObject(action) && action.not;
}

module.exports.process = function(action, context, callback, process_action) {
	process_action(action.not, context, function(err) {
		// Reverse the success/fail logic here
		if(err) {
			if(action.not.on_success) {
				return callback( { message : null });
			}
			return callback(); // Continue processing
		}
		else {
			return callback({ message : "Action should not have succeeded" });
		}
	});
}
