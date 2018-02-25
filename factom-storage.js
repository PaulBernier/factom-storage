const program = require('commander');

program
    .description('Upload or download files to/from Factom blockchain')
    .command('download', 'Download a file stored with Factom storage').alias('d')
    .command('upload', 'Upload a file in Factom storage').alias('u')
    .parse(process.argv);

// node factom-storage.js -u 'http://localhost:8088/v2' download XXX
// node factom-storage.js upload -m "My pic!" ./39921282302_b8d88f89c1_m.jpg EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD
