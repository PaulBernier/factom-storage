const program = require('commander');

program
    .description('Upload or download files to/from Factom blockchain')
    .command('download', 'Download a file stored with Factom storage').alias('d')
    .command('upload', 'Upload a file in Factom storage').alias('u')
    .parse(process.argv);

// node factom-storage.js -u 'http://localhost:8088/v2' download 777e06f51e251bd98c58b7f367775204edb55a43a1e16ee4fb696c4f666ccd42
// node factom-storage.js upload -u 'http://localhost:8088/v2' -m "My pic!" ./39921282302_b8d88f89c1_m.jpg EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD

// echo "my first entry" | factom-cli addentry -c 38454cbd4c465ee0b6dd6c07b180b8b2aa0a3a10a00e6ca324800e455ce4c8a3 EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD