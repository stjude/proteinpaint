######################
# Become a Certificate Authority
######################

# where to store SSL keys
if (($# != 1)); then
	echo "usage: ./ssl.sh [DIR = where to put localhost.key/.pem/.csr]"
	echo "see comments in the script file for loading and trusting the CA in OSX"
	exit 1
else 
	DIR=$1
fi

# Generate private key
openssl genrsa -des3 -out $DIR/myCA.key 2048
# Generate root certificate
openssl req -x509 -new -nodes -key $DIR/myCA.key -sha256 -days 825 -out $DIR/myCA.pem

######################
# Create CA-signed certs
######################

NAME=localhost # Use your own domain name
# Generate a private key
openssl genrsa -out $DIR/$NAME.key 2048
# Create a certificate-signing request
openssl req -new -key $DIR/$NAME.key -out $DIR/$NAME.csr
# Create a config file for the extensions
>$DIR/$NAME.ext cat <<-EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names
[alt_names]
DNS.1 = $NAME # Be sure to include the domain name here because Common Name is not so commonly honoured by itself
DNS.2 = bar.$NAME # Optionally, add additional domains (I've added a subdomain here)
EOF
# Create the signed certificate
openssl x509 -req -in $DIR/$NAME.csr -CA $DIR/myCA.pem -CAkey $DIR/myCA.key -CAcreateserial \
-out $DIR/$NAME.crt -days 825 -sha256 -extfile $DIR/$NAME.ext


# in OSX using the using the Keychain Access app:
#1. Open Keychain Access
#2. Choose "System" in the "Keychains" list
#3. Choose "Certificates" in the "Category" list
#4. Choose "File | Import Items..."
#5. Browse to the file created above, "rootCA.pem", select it, and click "Open"
#6. Select your newly imported certificate in the "Certificates" list.
#7. Click the "i" button, or right click on your certificate, and choose "Get Info"
#8. Expand the "Trust" option
#9. Change "When using this certificate" to "Always Trust"
#10. Close the dialog, and you'll be prompted for your password.
#11. Close and reopen any tabs that are using your target domain, and it'll be loaded securely!
