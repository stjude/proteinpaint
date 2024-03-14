#!/bin/bash

network_name="pp_network"

# Check if the network exists
if ! docker network ls | grep -q $network_name; then
  echo "Network $network_name does not exist. Creating..."
  docker network create $network_name
else
  echo "Network $network_name already exists. No action taken."
fi