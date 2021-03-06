var _ = require("underscore");
var fs = require("fs");
var yaml = require("js-yaml");

var load = require("./load");
var interpolate = require("./interpolate");
var normalize = require("./normalize");
var validate = require("./validate");
var request = require("./request");

function process(script, session, options) {
	// Shift parameters if needed
	if(options==null) {
		options = session;
		session = null;
	}
	if(!options) {
		options = { };
	}
	if(_.isFunction(options)) {
		options = { done : options };
	}
	if(!options.plugins) {
		options.plugins = load.plugins.defaults(options.safe);
	}
	if(!_.isFunction(options.done)) {
		throw new Error("Must pass a callback for done.");
	}
	if(!script) return options.done("Script is null", session);
	if(session && !_.isObject(session)) {
		options.done(new Error("Session is not a valid object"), session);
	}
	var normalized = normalize(script, options.plugins);
	if(!session) session = {};
	if(!options) options = {};
	process_step(_.first(normalized.steps), normalized, session, options);
}

function process_step(step, script, session, options) {
	request(step.request, session, options, function(err, response, buffer) {
		if(err) return options.done(err, session);
		var context = {
			options: options,
			session: session,
			response: response,
			body: buffer.toString(),
			buffer: buffer
		};
		if(options.before_validate) { options.before_validate(step, context); };
		validate(step, context, function(err, jump_to_key) {
			if(options.after_validate) { options.after_validate(step, err, jump_to_key); };
			if(err && !jump_to_key) {
				return options.done("Validation error - " + JSON.stringify(err), session);
			}
			var next_step = null;
			if(jump_to_key) {
				if(jump_to_key === "SELF" ) { // Jump to the same request again (warning, could cause indefinite loops)
					next_step = step;
				}
				else if(jump_to_key !== "END") {
					next_step = _.findWhere(script.steps, { name : jump_to_key } );
					if(!next_step) return options.done("Could not find request named " + jump_to_key, session);
				}
			}
			else {
				var next_index = _.indexOf(script.steps, step) + 1;
				if(next_index>0 && next_index<script.steps.length)
					next_step = script.steps[next_index];
			}
			if(options.request_completed) options.request_completed(step, next_step, script, session);
			if(!next_step) return options.done(null, session); // Reached the end of the script
			setImmediate( function() {
				process_step(next_step, script, session, options);
			});
		}, options.plugins);
	});
}

// Re-expose components
module.exports.interpolate = interpolate;
module.exports.normalize = normalize;
module.exports.load = load;
module.exports.processor = function(safe) {
	return { 
		plugins: load.plugins.defaults(safe),
		load: load,
		interpolate: interpolate,
		normalize: function(script) { return normalize(script, this.plugins); },
		use: function(plugins, safe) {
			if(_.isString(plugins)) {
				plugins = load.plugins.from_folder(plugins, safe);
			}
			else if(!_.isArray(plugins)) {
				plugins = [ plugins ];
			}
			for(var i=0; i<plugins.length; i++) {
				if(plugins[i].connect) 
					plugins[i].connect(this);
			}
			this.plugins = _.union(this.plugins, plugins);
		},
		process: function(script, session, options) {
			if(_.isFunction(options)) {
				options = { done: options };
			}
			var local_options = _.clone(options);
			local_options.plugins = _.union(this.plugins, options.plugins);
			process(script, session, local_options);
		}
	};
};

// Expose shortcut feature set
module.exports.yaml = {
	process_file : function (filename, session, options) {
		var script = load.scripts.yaml.file(filename, options.safe);
		process(script, session, options); 
	},
	process_text : function(script_text, session, options) {
		var script = load.scripts.yaml.text(script_text, options.safe);
		process(script, session, options); 
	}
}
