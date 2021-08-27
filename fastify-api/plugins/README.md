# README #

## Change history
The list of changes you need to make if you update the version of this package in a Node micro-service that uses it is below, most recent first. A breaking change is one which forces code to be changed in any of the modules that use a previous version of the package. For changes in functionality, please provide details and a helpful guide on what needs to be changed concretely.

### v0.21.1 - Change query parsing feature
Allow empty ids in fields provided in query parsing e.g. fld[name][op][], as requested by FE.

### v0.21.0 - Change query parsing feature
Change query filter parsing for IN operator for multiple values to accept them in separate query fields instead of joined by comma in value.
This may need changes in tests that use the in operator if the query-string is composed directly as a string.

Before: fld[city][in][1]=Arad,Cluj
After: fld[city][in][1]=Arad&fld[city][in][1]=Cluj

### v0.20.1 - Add feature
Add global search sequelize helper to re-use sequelize logic specific to global searches

### v0.20.0 - Baseline
Start of breaking changes recording. All Node modules have been updated to at least this version so the older history is not important anymore, but you can find in the GIT commit history.

## Using `fastify-global-plugins`

- Every plugin needs to sit in a separate folder
- This repo will be installed the projects that need it like an npm library, because npm allows you to use directly a git repo URL https://docs.npmjs.com/cli/v7/commands/npm-install, and it also allows version tags to be applied to it
- When we modify something in the global repo, we put a new tag with the next version according to semver rules: major version increase for a breaking change, minor version increase for new features, and patch version increase for bugfixes or comment changes.
  + The command is (`npm version major|minor|patch`)[https://travishorn.com/semantic-versioning-with-git-tags-1ef2d4aeede6] will automatically increase the version in package.json and applies a  tag in git with the incremented version. At the next commit, the tag is applied and a new git push is needed to upload the tag (which is always stored as a separate commit). You can use the pre-made `npm run push-tag` script to upload the tags.
- We try to make only non-breaking changes as much as possible and only if we cannot do that we will do a major version increment.
- There is a folder /services with folders or files named the same as the plugin they contain.
- Acest repo are doar master branch si feature/bugfix branches, cele din urma temporare. Versiunile din feature/bugfix sunt cele taguite si dupa PR tagurile sunt mutate pe master, fiindca altfel daca avem si develop am fi avut probleme cu celelalte proiecte legate de taguri: ar fi trebuit mutate de pe develop in master pe masura ce diverse features asociate ajung in branchurile de develop sau master din proiectele normale.
- Dezavantaje:
	+ Daca avem nevoie de un singur plugin, npm va instala toate librariile folosite in global, insa nu ne afecteaza cu nimic, doar ca e extra code size care iarasi e ok, doar daca am fi FE devs ar fi mai nasol (caz in care am folosi tree-shaking cu webpack sau ceva similar)
	+ Daca facem un breaking change fiindca avem nevoie de un plugin imbunatatit in global pentru proiect1, si dupa asta incepe in paralel acelasi lucru pentru proiect2, trebuie sa asteptam in proiect2 pana ce se  termina modificarea la proiect1 sa fie merguita. Abia apoi putem sa facem merge la proiect 2 (proiectele incearca sa acceseze pentru a modifica aceeasi resursa ca niste threaduri paralele si trebuie sa se astepte)


## Updating `fastify-global-plugins` repo with `npm link`:
  + Run `npm link fastify-global-plugins ../fastify-global-plugins` (use the path to your local clone of the global repo)
  + Make any modification in your local clone of the global repo and it will take effect in your working project
  + If everything is ok, commit the global plugins changes with a PR and if it passes the code review we merge it into master and apply a tag. Make sure that the tag version is not already used.
  + Make a new commit in your working project with the latest tag for `fastify-global-plugins` and submit it for code review
  + If the code review passes merge it and everything will be fine. If further changes are needed in the global plugins repo you need to repeat the process from step 2.

## Fastify projects guidelines:

- For future-proofing our imports/exports format we use ES6 modules `import x from 'x';` instead of CommonJS `const x = require('x');` as Node will transition to this new format to match browser JS implementations.
- A plugin that will likely be needed in other projects in the future is put in the global-plugins repository which contains shared cross-project plugins and helpers. 
  + Everything put in the global-plugins repo should be 100% configurable.
  + Before writing a plugin we need to check if it is already in that repo.
  + If a global plugin grows to large or depends on some services, put it inside a folder in there with an index.js and split the code into several files/subdirectories in that folder
- In Fastify the Docs make clear that everything should be a plugin to allow separation of concerns. This is closer to Functional Programming than OOP since the plugin is a function. But services and other useful functionality can be encapsulated either in higher-order functions and closures (FP approach) or classes (OOP approach) whichever is more convenient. A plugin per file is probably easier to maintain.
- If file grows too large it can be split into a folder with an index.js which loads multiple files that contain the pieces of the large file. This can be done with the fastify-autoload plugin or with a code that reads every file in its directory and imports it dynamically.
- Plugins encapsulate various functionalities via decorators and hooks and access is passed down to child plugins (registered inside a parent plugin) like variable local scoping.
  + The input of a plugin is the second (opts) argument, and the hooks it adds are side-effects.
  + Decorators can be used as inputs (getters, accessing decorators defined in other plugins) or as outputs (when setting or modifying decorators to be consumed by other plugins).
  + Use opts only to pass parameters that configure the plugin differently when loading it with fastify.register, i.e. they allow you to instantiate different versions of the same plugin that work differently depending on opts.
  + For other inputs use decorators, and make sure to specify their dependencies to have access to them.
  + Wherever is possible, when writing a plugin, make sure to pass all the plugin's dependencies via the opts argument or via decorators (similar to dependency injection from OOP or pure functions in FP) so that a plugin can be easily mocked or replaced during testing, also to make it more extensible and less coupled to its dependencies
- Plugins are often used to encapsulate services and make them available to the whole application via decorators or hooks. 
  + Services are defined in the /services folder, and imported and set up in a plugin, which may depend on other services setup in other plugins in which case the dependent plugins are specified in the fp() dependencies option. 
  + When splitting code between a plugin and its associated service source code files, what is invariant regardless of the Node framework stays in the services file, and what depends on the used framework (e.g. adaptor between the service and fastify hooks or decorators) stay in the plugin file.
- The main setup plugin in setup.js registers global API-level functionality which is standard / used in almost any API.
- Inside a plugin we can use `await fastifi.after();` to wait for all previous `fastify.register(plugin, opts)` calls to finish. (From Fastify/Avvio Docs)[https://github.com/fastify/avvio#await-appafter--appafter--promise]: `Calling after with no function argument loads any plugins previously registered via use and returns a promise, which resolves when all plugins registered so far have loaded`.
- Plugins in /plugin folder are project-specific and global to the project, and are wrapped under fp() to be able to 'export' decorators, hooks, etc to the whole app. If too many of these plugins depend on the same plugin, it may be better to move that plugin in the setup.js plugin.
- A plugin should in general instantiate a service, encapsulate a library, receive all its options and configs via the opts argument, have defaults for every option, or throw error if not provided. It should gracefully close opened connections, connection pools, clients, etc. by registering the onClose fastify hook. At the end a non-global plugin (i.e. not from global-plugins repo) displays a log.info message on what it accomplished to do e.g. `Loaded services: 'response', 'pubSub'`
- The Dockerfile for production with the multi-stage build can use the intermediary image to make any checks you need, run tests, dependency checks etc. an only if they pass the final production image will be built.
- Every utility command or script relevant to the project should be added to the package.json scripts section, e.g. for migrations, docker build, run tests, start server etc.
- A Postman collection with all routes is provided in the project repo and updated along with the routes (exported from the Postman UI), and the base URL or any other variable used in the Postman routes is defined at the collection level (because global variables are not exported along with a collection).
- Project level configuration variables are stored in appConfig.js which has access to ENV variables (which are used to store secrets and define the deployment environment e.g. stage, production, development). Both appConfig.js and the ENV variables are validated against a schema to prevent bugs.
- There is a separate env file for each environment according to the 12 Factor App principles.
- We need to put complicated SQL queries in a separate root folder in the repo. In case we have findAll or other basic ORM method calls we can leave them directly in the business logic service class, but if we more complicated queries, say more than 2-3 lines of ORM calls or raw SQL, we can put these in a folder /repositories (these would be classes than encapsulate these complicated queries).
- We use https://www.npmjs.com/package/npm-merge-driver-install, a package to automatically merge package-lock.json conflicts. Heavily based on npm-merge-driver with automated setup at package install time and a single small dependency for ci checking. More details here: https://stackoverflow.com/questions/50160311/auto-merging-package-lock-json
- Routes are grouped by folders that specify api versions, which also are automatically picked up by the Swagger docs generator to be included in tags.
- Most plugins are grouped and loaded either in the setup.js plugin or via the fastify-autoload plugin. The rest are loaded inside one of the previously mentioned plugins.
- The utils plugin loads and makes available via decorators any utility library that may be used in multiple places across the app, especially in routes.
- Plugins that load various groups of handlers, schemas, routes etc. are put in the /plugins/loaders folder while the other plugins are put in /plugins/setup general plugins that wrap, encapsulate or set up services / libraries needed in other plugins across the app (set up a top-level service, global-plugin, an external plugin or a library))
- Any file or folder named `common(.js)` is ignored by the auto-loader plugin (this ignore pattern is specified via appConfig.js), and is actually used as pattern across the app i.e. also when doing automatic inclusion of every file in a directory using dynamic imports.
- Errors
  = Errors that are thrown during runtime (after server setup and startup) are created or thrown using the following template. They also include an error class code, and are caught by a custom error handler that formats them to the standard response structure:
    + Internal server errors are replaced in production with a generic message so they will not be localized.
      `fastify.httpErrors.throwInternalServerError(
        'Received error while publishing on topic' + topic + publishError.message,
        { errClass: 102 }
      );`
    + Client errors are localized so any dynamic content must be sent as a separate parameter:
      `fastify.httpErrors.throwBadRequest(
        'Topic name {{name}} is not correct in namespace {{namespace}}',
        { errClass: 103, params: { name: 'Topic2', namespace: 'urgent-message' } }
      );`
  = Whenever an internal server error (so not one sent to a user) is caught but its default message is not helpful, it is either completely rewritten or a more informative one is pre-pended to the `message` property and then re-thrown to preserve its stack trace until the point of re-throw.
  = If the error class code is not provided, the default value of 0 will be used. We should not use it anywhere else because this allows us to know when we forget to set it.
  = Error class codes from 0 to 99 are reserved for the `fastify-global-plugins` repo so that we can identify easily their origin when this library is used in a microservice or another.
  = If an internal error code is not provided, one will be autogenerated using a hash of the error message. This allows us to avoid keeping track of manual codes if a new one was already used before in another source code file.
  = The 902 internal error code is reserved for validation errors, and 0 should not be used so we know if we want to set it but we forgot to.
- In order to avoid too many try / catch {} nested blocks, the `const [err, value] - await fastify.utils.to(Promise or function);` method inspired from `fastify-sensible` can be used which is equivalent to try / catch; If you provide a sync function, it will be called and any synchronous thrown error will be caught just like a promise rejection.
- If you encounter the `FastifyError: Schema with id '#id' already declared!` error when handling JSON schemas, you can use the following workarounds:
  + The `S.mergeSchemas(objectSchema1, objectSchema2, optionalNewId)` method from global utils can replace the id of the merged result in case the problematic schema is the result of a merge between two object schemas.
  + If the problematic schema has any type other than object, you can override the id directly: `S.string().id('#id1').id('#id2')` will have as id '#id2'.
  + The `S.removeId(schema)` method from global utils can remove the id entirely from a schema, regardless of type;