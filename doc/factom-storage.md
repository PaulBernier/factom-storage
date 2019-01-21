# Introduction

Factom-storage is a simple proof of concept to store and retrieve complete files in the Factom blockchain. That said having a blockchain storage at a *fixed* rate (not dependending on fluctuation of the market) is not that a crazy idea and could be useful to some folks.

# Write operation

## Input

* File path
* (Optional) File meta data (description, caption of picture...)
* EC address to pay

## Process

* Files is compressed (zlib) to try to save some space
* Chain is created and contains the "header" of the file (various information to retrieve the file and check its integrity)
* File is split in chunks (of a bit less than 10kb, the maximum allowed per EC)
* File part entries are created and added to the chain in parallel (no need to insert them sequentially as each part has its order)
* Return the chainId and the private key used to sign (to optionaly prove ownership of the upload)

## Chain first entry

### ExtIds

* 'factom-storage': human readable marker that it is a factom-storage chain
* version: version of factom-storage used to store the file. Will be used to recover the file if multiple versions (with different storage scheme) are introduced
* filename: original filename. Used when recovering the file
* size: size of the file. Mostly indicative, used as an extra validation check (but signature would already cover that)
* file hash: sha512 of the file.
* publicKey: EdDSA ed25519 public key corresponding to the private key used to sign the file and all the parts
* signature: ed25519 signature of the whole file

### Content

* fileDescription: free text for user to add meta information to attach to the file

## File part entries

### ExtIds

* order (4 bytes): order of the part
* signature (64 bytes): signature (content + whole file sha512)

### Content

* Actual chunk of data (10240 - 2 * 2 - 4 - 64 = 10168 bytes of pure data)

# Read operation

## Input

* ChainId of the file

## Process

* All entries of the chain are retrieved
* Check header that it's a valid factom-storage chain
* Verify the signature of each parts (concatenated with file hash) and discard the invalid values (if someone added/replayed unwanted entries in the chain for instance)
* Concatenare the content of all entries
* Verify the signature of the whole file (concatenated with file hash) against the header and the file size
* Uncompress to recover original
* Use original file name from the header to write the fetched file on the disk
