const program = require('commander');

program
    .description('Upload or download files to/from Factom blockchain')
    .command('download', 'Download a file stored with Factom storage').alias('d')
    .command('upload', 'Upload a file in Factom storage').alias('u')
    .parse(process.argv);

// node factom-storage.js upload -m "My pic!" ./39921282302_b8d88f89c1_m.jpg EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD
// node factom-storage.js upload -m "My pic!" ./39921282302_b8d88f89c1_m.jpg Es32PjobTxPTd73dohEFRegMFRLv3X5WZ4FXEwNN8kE2pMDfeMym
// node factom-storage.js download e1e1a5cbfb153d92bfd0db4dcd7bf2cfcdb52e4d3bb05beada8c9e70536a455e

