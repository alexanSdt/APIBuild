/*
Lint scripts.
*/

function hint(msg, args) {
    return function () {
        console.log(msg);
        jake.exec('node node_modules/eslint/bin/eslint.js ' + args,
                {printStdout: true}, function () {
            console.log('\tCheck passed.\n');
            complete();
        });
    };
}

desc('Check Leaflet source for errors with ESLint');
task('lint', {async: true}, hint('Checking for JS errors...', 'external --ext .js --config build/eslintrc.json'));

task('default', ['lint']);
