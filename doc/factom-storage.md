# Introduction

Factom-storage is a simple proof of concept to store and retrieve complete files in the Factom blockchain. That said having a blockchain storage at a *fixed* rate (not dependending on fluctuation of the market) is not that a crazy idea and could be useful to some folks.

# Write operation

## Input

* File path.
* (Optional) File meta data.
* (Optional) Identity key for authentication. Auto generated otherwise.
* EC address to pay.

## Process

* Files is compressed (zlib) to try to save some space.
* Chain is created and contains the "header" of the file (various information to retrieve the file and check its integrity).
* File is split in chunks (of a bit less than 10kb, the maximum allowed per EC).
* File part entries are created and added to the chain concurrently (no need to insert them sequentially as each part has its order).
* Return the chainId of the file and the key pair used to sign if it was auto generated (to optionaly prove ownership of the upload).

## Chain first entry

### ExtIds

* 'factom-storage': human readable marker that it is a factom-storage chain.
* version: version of factom-storage used to store the file. Will be used to recover the file if multiple versions (with different storage scheme) are introduced.
* filename: original filename. Used when recovering the file.
* size: size of the file. Mostly indicative, used as an extra validation check.
* file hash: sha512 of the file.
* publicKey: raw ed25519 public key corresponding to the private key used to sign the file and all the parts.
* signature: signature of the whole file.

### Content

* metadata: for user to add meta information to attach to the file.

## File part entries

### ExtIds

* order (4 bytes): order of the part.
* signature (64 bytes): signature of (order + content + chain ID) using the key declared in the first entry.

### Content

* Actual chunk of data (10240 - 2 * 2 - 4 - 64 = 10168 bytes of data)

# Read operation

## Input

* Chain ID of the file

## Process

* All entries of the chain are retrieved.
* Check header that it's a valid factom-storage chain.
* Verify the signature of each parts and discard the invalid values (if someone added/replayed unwanted entries in the chain for instance)
* Remove possible duplicates due to replay.
* Concatenare the content of all entries.
* Verify the file size and the signature of the whole file against the header (first entry). 
* Uncompress to recover original.
* Use original filename from the header to write the fetched file on the disk.
