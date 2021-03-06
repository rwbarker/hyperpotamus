var _ = require("underscore");
var fs = require("fs");
var yaml = require("js-yaml");
var assert = require("assert");
var path = require("path");

// Script loading functions
function yaml_text(script_text, safe_only) {
	assert(_.isString(script_text), "script_text must be a string");
	assert(script_text, "script_text is blank");
	if(safe_only)
		return yaml.safeLoad(script_text); // TODO - options for unsafe loading
	else
		return yaml.load(script_text);
}

function yaml_file(filename, safe_only) {
	var script_text = fs.readFileSync(filename, "utf-8");
	return yaml_text(script_text, safe_only);
}

// Handler loading functions
var default_plugin_folder = path.join(__dirname, "default_plugins");

function readJsFiles(folder, safe_only) {
	folder = path.resolve(folder);
	if(!fs.existsSync(folder)) throw new Error("Folder does not exist - " + folder);
	var files = fs.readdirSync(folder);
	var jsfiles = _.filter(files, function(file) { return path.extname(file)===".js"; });
	var plugins = _.map(jsfiles, function(file) { return require(path.join(folder, file)); } );
	if(safe_only)
		plugins = _.filter(plugins, function(plugin) { return !!plugin.safe; });
	return plugins;
}

module.exports = {
	scripts : {
		yaml: {
			text : yaml_text,
			file : yaml_file,
		},
	},
	plugins: {
		defaults: function(safe_only) { return readJsFiles(default_plugin_folder, safe_only) },
		from_folder: function(folder, safe_only) { return readJsFiles(folder, safe_only); }
	}
}
