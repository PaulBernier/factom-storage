# factom-storage

## Installation

```bash
sudo npm install -g factom-storage
```

## Usage

### Upload

```bash
factom-storage upload [options] <file> <EC address for payment>

  Upload a file in Factom storage

  Options:

    -m, --meta <meta>      Optional textual meta information about the file to be stored
    -s, --socket <socket>  IPAddress:port of factomd API (default localhost:8088)
    -h, --help             output usage information
```

```bash
# If you provide a public EC address for payment factom-storage will attempt to retrieve the private key from a local walletd running on port 8089
factom-storage upload -s '52.202.51.229:8088' -m "My pic!" ./my_picture.jpg EC2vXWYkAPduo3oo2tPuzA44Tm7W6Cj7SeBr3fBnzswbG5rrkSTD
# If you provide directly a private EC address the tool doesn't need access to walletd
factom-storage upload -s '52.202.51.229:8088' -m "My pic!" ./my_picture.jpg Es32PjobTxPTd73dohEFRegMFRLv3X5WZ4FXEwNN8kE2pMDfeMyk
```

### Download

```bash
Usage: factom-storage download <chain ID of the file>

  Download a file stored with Factom storage

  Options:

    -s, --socket <socket>  IPAddress:port of factomd API (default localhost:8088)
    -h, --help             output usage information
```

```bash
factom-storage download -s '52.202.51.229:8088' e1e1a5cbfb153d92bfd0db4dcd7bf2cfcdb52e4d3bb05beada8c9e70536a455e
```