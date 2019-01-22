# factom-storage

Factom-storage is a simple proof of concept to store and retrieve complete files in the Factom blockchain. That said having a blockchain storage at a fixed rate (not dependending on fluctuation of the market) is not that a crazy idea and can have some actual utility.

Please checkout doc folder for technical details on how your documents are uploaded.

## Installation

```bash
sudo npm install -g factom-storage
```

## Usage

### Upload

```bash
factom-storage upload <file>

Upload a file to the Factom blockchain.

Positionals:
  file  File to upload to Factom

Options:
  --help             Show help
  --version          Show version number
  --socket, -s       IPAddress:port of factomd API
  --wallet, -w       IPAddress:port of walletd API
  --key, -k          A Factom digital identity key (idpub or idsec) or a 32-byte seed to be used to sign the file
  --ecaddress, --ec  EC address to pay for the created chain and entries
  --meta, -m         Textual meta information about the file to be stored
```

```bash
# If you provide a public EC address for payment factom-storage will attempt to retrieve the private key from a local walletd running on port 8089 (wallet location can be specified with -w flag).
factom-storage upload -s '52.202.51.229:8088' -m "My pic!" --ec EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD ./my_picture.jpg
# If you provide directly a private EC address the tool does not need access walletd.
factom-storage upload -s '52.202.51.229:8088' -m "My pic!" --ec Es32PjobTxPTd73dohEFRegMFRLv3X5WZ4FXEwNN8kE2pMDfeMyk ./my_picture.jpg
```

### Download

```bash
factom-storage download <chainid>

Download a file from the Factom blockchain.

Positionals:
  chainid  Chain ID of the file to download

Options:
  --help        Show help
  --version     Show version number
  --socket, -s  IPAddress:port of factomd API
```

```bash
factom-storage download -s '52.202.51.229:8088' e1e1a5cbfb153d92bfd0db4dcd7bf2cfcdb52e4d3bb05beada8c9e70536a455e
```
