/**
 * Module dependencies
 */

var _ = require('@sailshq/lodash');
var flaverr = require('flaverr');
var includeAll = require('include-all');



/**
 * loadHelpers()
 *
 * Load helper definitions from disk, build them into Callables, then attach
 * them to the `sails.helpers` dictionary.
 *
 * @param {SailsApp} sails
 * @param {Function} done
 *        @param {Error?} err
 */
module.exports = function loadHelpers(sails, done) {

  // Load helper defs out of the specified folder
  includeAll.optional({
    dirname: sails.config.paths.helpers,
    filter: /^([^.]+)\.(?:(?!md|txt).)+$/,
    flatten: true,
    keepDirectoryPath: true
  }, function(err, helperDefs) {
    if (err) { return done(err); }

    // If any helpers were specified when loading Sails, add those on
    // top of the ones loaded from disk.  (Experimental)
    if (sails.config.helpers.moduleDefinitions) {
      // Note that this is a shallow merge!
      _.extend(helperDefs, sails.config.helpers.moduleDefinitions);
    }

    try {
      // Loop through each helper def, attempting to build each one as
      // a Callable (a.k.a. "wet machine")
      _.each(helperDefs, function(helperDef, identity) {
        try {
          // Camel-case every part of the file path, and join with dots
          // e.g. /user-helpers/foo/my-helper => userHelpers.foo.myHelper
          var keyPath = _.map(identity.split('/'), _.camelCase).join('.');

          // Save _loadedFrom property for debugging purposes
          // (e.g. `financial/calculate-mortgage-series`)
          helperDef._loadedFrom = identity;

          // Use filename-derived `identity` REGARDLESS if an explicit identity
          // was set.  (And exclude any extra hierarchy.)  Otherwise, as of
          // machine@v15, this could fail with an ImplementationError.
          helperDef.identity = identity.match(/\//) ? _.last(identity.split('/')) : identity;

          // Build & expose helper on `sails.helpers`
          // > e.g. sails.helpers.userHelpers.foo.myHelper
          sails.hooks.helpers.furnishHelper(keyPath, helperDef);
        } catch (err) {
          // If an error occurs building the callable, throw here to bust
          // out of the _.each loop early
          throw flaverr({
            code: 'E_FAILED_TO_BUILD_CALLABLE',
            identity: helperDef.identity,
            loadedFrom: identity,
            raw: err
          }, err);
        }
      });//∞

    } catch (err) {

      // Handle any errors building Callables for our helpers by sending the
      // errors through the hook callback, which will cause Sails to halt lifting.
      if (flaverr.taste('E_FAILED_TO_BUILD_CALLABLE', err)) {
        return done(flaverr({
          message: 'Failed to load helper `' + err.loadedFrom +'` into a Callable!  '+err.message
        }, err));
      } else {
        return done(err);
      }

    }//</ caught >

    // --• Everthing worked!
    return done();

  });

};