#!/bin/sh -e

if [ -z "$SNAPCRAFT_SECRET" ]; then
    # Run `sh seed.sh` on your local machine so SNAPCRAFT_SECRET is set.
    exit 0
fi

mkdir -p ".encrypted"
if [ ! -e ".encrypted/snapcraft.cfg.enc" ]; then
    echo "Seeding a new macaroon."
    echo "$SNAPCRAFT_CONFIG" > ".encrypted/snapcraft.cfg.enc"
fi

mkdir -p "$HOME/.config/snapcraft"
# Decrypt the macaroon (secret).
openssl enc -aes-256-cbc -base64 -pass env:SNAPCRAFT_SECRET -d -in ".encrypted/snapcraft.cfg.enc" -out "$HOME/.config/snapcraft/snapcraft.cfg"
