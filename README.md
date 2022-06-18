# Union Indexer

The union indexer is focused on indexing multiple sources of social media posts.
At the moment the indexer supports:
- Offchain Ceramic content
- HIVE content


# Installation:
Prerequisites:
- Git
- Docker

Git clone:
```
git clone https://github.com/spknetwork/union-indexer-node
```
Start docker container:
```
docker-compose up
```


# Usage

### Requirements
- Ceramic API endpoint
- SPK Offchain Indexer API endpoint

### API

The API is available on port 4568. 
The following endpoints are available (subject to change):
- /api/v1/create_stream_id - creates an offchain stream id 
- /api/v1/graphql - graphql API and graphiql explorer