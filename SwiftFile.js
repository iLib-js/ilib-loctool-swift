/*
 * SwiftFile.js - plugin to extract resources from a Swift source code file
 *
 * Copyright © 2016-2017, 2023 HealthTap, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var fs = require("fs");
var path = require("path");

var IString = require("ilib/lib/IString.js");

/**
 * Create a new java file with the given path name and within
 * the given project.
 *
 * @param {Project} project the project object
 * @param {String} pathName path to the file relative to the root
 * of the project
 * file
 */
var SwiftFile = function(options) {
    this.project = options.project;
    this.pathName = options.pathName;
    this.type = options.type;

    this.API = this.project.getAPI();

    this.locale = this.locale || (this.project && this.project.sourceLocale) || "en-US";

    this.set = this.API.newTranslationSet(this.locale);
    this.logger = this.API.getLogger("loctool.plugin.SwiftFile");
};

var reUnicodeChar = /\\u\{([a-fA-F0-9]{1,5})\}/g;

/**
 * Unescape the string to make the same string that would be
 * in memory in the target programming language.
 *
 * @static
 * @param {String} string the string to unescape
 * @returns {String} the unescaped string
 */
SwiftFile.unescapeString = function(string) {
    if (!string) return string;
    var unescaped = string;

    while ((match = reUnicodeChar.exec(unescaped))) {
        if (match && match.length > 1) {
            var value = parseInt(match[1], 16);
            unescaped = unescaped.replace(match[0], IString.fromCodePoint(value));
            reUnicodeChar.lastIndex = 0;
        }
    }

    unescaped = unescaped.
        replace(/^\\\\/, "\\").
        replace(/([^\\])\\\\/g, "$1\\").
        replace(/^\\'/, "'").
        replace(/([^\\])\\'/g, "$1'").
        replace(/^\\"/, '"').
        replace(/([^\\])\\"/g, '$1"');

    return unescaped;
};

/**
 * Clean the string to make a source string. This means
 * removing leading and trailing white space, compressing
 * whitespaces, and unescaping characters. This changes
 * the string from what it looks like in the source
 * code.
 *
 * @static
 * @param {String} string the string to clean
 * @returns {String} the cleaned string
 */
SwiftFile.cleanString = function(string) {
    var unescaped = SwiftFile.unescapeString(string);

    unescaped = unescaped.
        replace(/\\[btnfr]/g, " ").
        replace(/[ \n\t\r\f]+/g, " ").
        trim();

    return unescaped;
};


/**
 * Make a new key for the given string. This must correspond
 * exactly with the code in htglob jar file so that the
 * resources match up. See the class IResourceBundle in
 * this project under the java directory for the corresponding
 * code.
 *
 * @private
 * @param {String} source the source string to make a resource
 * key for
 * @returns {String} a unique key for this string
 */
SwiftFile.prototype.makeKey = function(source) {
    if (!source) return undefined;

    // the cleaned source is the key
    return SwiftFile.cleanString(source);
};

var reNSLocalizedStringBogusConcatenation1 = /(^NS|\WNS|^HT|\WHT)LocalizedString\s*\(\s*"(\\"|[^"])*"\s*\+/g;
var reNSLocalizedStringBogusConcatenation2 = /(^NS|\WNS|^HT|\WHT)LocalizedString\s*\([^\)]*\+\s*"(\\"|[^"])*"\s*\)/g;
var reNSLocalizedStringBogusParam = /(^NS|\WNS|^HT|\WHT)LocalizedString\s*\([^"\)]*\)/g;

var reNSLocalizedString = /(^NS|\WNS|^HT|\WHT)LocalizedString\s*\(\s*"((\\"|[^"])*)"\s*,/g;

var reNSLocalizedStringComment = /\s*comment:\s*("((\\"|[^"])*)")\s*\)/;

/**
 * Parse the data string looking for the localizable strings and add them to the
 * project's translation set.
 * @param {String} data the string to parse
 */
SwiftFile.prototype.parse = function(data) {
    this.logger.debug("Extracting strings from " + this.pathName);
    this.resourceIndex = 0;

    reNSLocalizedString.lastIndex = 0; // for safety
    var comment, result = reNSLocalizedString.exec(data);
    while (result && result.length > 1 && result[2] && result[2].trim().length > 0) {
        this.logger.trace("Found string key: " + this.makeKey(result[2]) + ", string: '" + result[2] + "', comment: " + (result.length > 4 ? result[5] : undefined));

        var last = data.indexOf('\n', reNSLocalizedString.lastIndex);
        last = (last === -1) ? data.length : last;
        var line = data.substring(reNSLocalizedString.lastIndex, last);
        var commentResult = reNSLocalizedStringComment.exec(line);
        comment = (commentResult && commentResult.length > 2) ? commentResult[2] : undefined;

        var r = this.API.newResource({
            resType: "string",
            project: this.project.getProjectId(),
            key: this.makeKey(result[2]),
            sourceLocale: this.project.sourceLocale,
            source: SwiftFile.unescapeString(result[2]),
            autoKey: true,
            pathName: this.pathName,
            state: "new",
            comment: comment ? SwiftFile.unescapeString(comment) : undefined,
            datatype: this.type.datatype,
            index: this.resourceIndex++
        });
        this.set.add(r);
        result = reNSLocalizedString.exec(data);
    }

    // now check for and report on errors in the source
    this.API.utils.generateWarnings(data, reNSLocalizedStringBogusConcatenation1,
        "Warning: string concatenation is not allowed in the NSLocalizedString() parameters:",
        this.logger,
        this.pathName);

    this.API.utils.generateWarnings(data, reNSLocalizedStringBogusConcatenation2,
        "Warning: string concatenation is not allowed in the NSLocalizedString() parameters:",
        this.logger,
        this.pathName);

    this.API.utils.generateWarnings(data, reNSLocalizedStringBogusParam,
        "Warning: non-string arguments are not allowed in the NSLocalizedString() parameters:",
        this.logger,
        this.pathName);
};

/**
 * Extract all the localizable strings from the file and add them to the
 * project's translation set.
 */
SwiftFile.prototype.extract = function() {
    this.logger.debug("Extracting strings from " + this.pathName);
    if (this.pathName) {
        var p = path.join(this.project.root, this.pathName);
        try {
            var data = fs.readFileSync(p, "utf8");
            if (data) {
                this.parse(data);
            }
        } catch (e) {
            this.logger.warn("Could not read file: " + p);
            this.logger.warn(e);
        }
    }
};

/**
 * Return the set of resources found in the current Objective C file.
 *
 * @returns {TranslationSet} The set of resources found in the
 * current file.
 */
SwiftFile.prototype.getTranslationSet = function() {
    return this.set;
}

//we don't localize or write Objective C source files
SwiftFile.prototype.localize = function() {};
SwiftFile.prototype.write = function() {};

module.exports = SwiftFile;
