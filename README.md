# Decked Out 2 Backend API

API backend server for Decked Out 2 on the [Tracked Out](https://trackedout.org) network.

### Changelog

For a list of changes, see the [latest release notes](https://github.com/trackedout/dunga-dunga-backend/releases/tag/latest).

## Quick Start

Checkout https://github.com/trackedout/davybones and run it in dev mode by setting `DEV=1` in `.env` and running `just start`.

Once that's running, navigate to http://localhost:3000/v1/docs in your browser to see the API documentation generated by Swagger.

## API Routes

### Inventory
- **GET /storage/items**: Retrieve a list of all items in the inventory.
  - **Parameters**:
    - `name` (optional): Filter items by name.
    - `player` (optional): Filter items by player.
    - `deckType` (optional): Filter items by deck type.
    - `deckId` (optional): Filter items by deck ID.
    - `sortBy` (optional): Sort items by field in ascending or descending order.
    - `projectBy` (optional): Project specific fields.
    - `limit` (optional): Limit the number of items returned.
    - `page` (optional): Specify the page number for pagination.
- **POST /storage/add-item**: Add a new item to a player's deck.
  - **Request Body**:
    - `item` (required): The item object to be added. See the [Item schema](https://github.com/trackedout/dunga-dunga-backend/blob/main/packages/components.yaml).
- **POST /storage/delete-item**: Remove an item from the inventory.
  - **Request Body**:
    - `itemId` (required): The ID of the item to be deleted.
- **GET /storage/:itemId**: Retrieve details of a specific item by its ID.

### Cards
- **GET /inventory/cards**: Retrieve a list of all cards in the inventory.
  - **Parameters**: Similar to the Inventory items endpoint.
- **POST /inventory/add-card**: Add a new card to a player's deck.
  - **Request Body**:
    - `card` (required): The card object to be added. See the [Card schema](https://github.com/trackedout/dunga-dunga-backend/blob/main/packages/components.yaml).
- **POST /inventory/delete-card**: Remove a card from the inventory.
  - **Request Body**:
    - `cardId` (required): The ID of the card to be deleted.
- **PUT /inventory/overwrite-player-deck**: Overwrite a player's entire deck with a new set of cards.
  - **Request Body**:
    - `deck` (required): The new deck object to replace the existing one. See the [Deck schema](https://github.com/trackedout/dunga-dunga-backend/blob/main/packages/components.yaml).
- **GET /inventory/:cardId**: Retrieve details of a specific card by its ID.

### Tasks
- **POST /tasks**: Create a new task.
  - **Request Body**:
    - `task` (required): The task object to be created. See the [Task schema](https://github.com/trackedout/dunga-dunga-backend/blob/main/packages/components.yaml).
- **GET /tasks**: Retrieve a list of all tasks.
  - **Parameters**:
    - `server` (optional): Filter tasks by server.
    - `type` (optional): Filter tasks by type.
    - `state` (optional): Filter tasks by state.
    - `sortBy` (optional): Sort tasks by field in ascending or descending order.
    - `projectBy` (optional): Project specific fields.
    - `limit` (optional): Limit the number of tasks returned.
    - `page` (optional): Specify the page number for pagination.
- **GET /tasks/:taskId**: Retrieve details of a specific task by its ID.
- **PATCH /tasks/:taskId**: Update details of a specific task by its ID.
  - **Request Body**:
    - `task` (required): The updated task object. See the [Task schema](https://github.com/trackedout/dunga-dunga-backend/blob/main/packages/components.yaml).

### Claims
- **GET /claims**: Retrieve a list of all claims.
  - **Parameters**:
    - `player` (optional): Filter claims by player.
    - `state` (optional): Filter claims by state.
    - `type` (optional): Filter claims by type.
    - `claimant` (optional): Filter claims by claimant.
    - `sortBy` (optional): Sort claims by field in ascending or descending order.
    - `projectBy` (optional): Project specific fields.
    - `limit` (optional): Limit the number of claims returned.
    - `page` (optional): Specify the page number for pagination.
- **POST /claims/add-claim**: Add a new claim for a player.
  - **Request Body**:
    - `claim` (required): The claim object to be added. See the [Claim schema](https://github.com/trackedout/dunga-dunga-backend/blob/main/packages/components.yaml).
- **POST /claims/delete-claim**: Remove a claim.
  - **Request Body**:
    - `claimId` (required): The ID of the claim to be deleted.
- **GET /claims/:claimId**: Retrieve details of a specific claim by its ID.
- **PATCH /claims/:claimId**: Update details of a specific claim by its ID.
  - **Request Body**:
    - `claim` (required): The updated claim object. See the [Claim schema](https://github.com/trackedout/dunga-dunga-backend/blob/main/packages/components.yaml).

### Scores
- **GET /scores**: Retrieve a list of all scores.
  - **Parameters**:
    - `player` (optional): Filter scores by player.
    - `sortBy` (optional): Sort scores by field in ascending or descending order.
    - `projectBy` (optional): Project specific fields.
    - `limit` (optional): Limit the number of scores returned.
    - `page` (optional): Specify the page number for pagination.
- **POST /scores/add-score**: Add a new score to a player's record.
  - **Request Body**:
    - `score` (required): The score object to be added. See the [Score schema](https://github.com/trackedout/dunga-dunga-backend/blob/main/packages/components.yaml).
- **POST /scores/delete-score**: Remove a score.
  - **Request Body**:
    - `scoreId` (required): The ID of the score to be deleted.
- **GET /scores/:scoreId**: Retrieve details of a specific score by its ID.

### Events
- **POST /events**: Log a dungeon event from one of the Decked Out 2 instances.
  - **Request Body**:
    - `event` (required): The event object to be logged. See the [Event schema](https://github.com/trackedout/dunga-dunga-backend/blob/main/packages/components.yaml).
- **GET /events**: Retrieve a list of all events (only accessible by admins).
  - **Parameters**:
    - `name` (optional): Filter events by name.
    - `server` (optional): Filter events by server.
    - `player` (optional): Filter events by player.
    - `sortBy` (optional): Sort events by field in ascending or descending order.
    - `projectBy` (optional): Project specific fields.
    - `limit` (optional): Limit the number of events returned.
    - `page` (optional): Specify the page number for pagination.

### Status
- **GET /status**: Retrieve the current status of the server and its components.

### Development Routes
- **GET /docs**: View API documentation (only in development mode). This route provides access to the Swagger UI, which allows for interactive exploration and testing of the API endpoints.

For detailed API documentation, visit the Swagger UI at http://localhost:3000/v1/docs.

## Supported Events

### Player Events
- **allowed-to-play**: Indicates a player is allowed to play. When processed, the system updates the player's status to allow them to join the game. This event is logged to ensure the player has met all necessary criteria to participate.
- **joined-queue**: A player has joined the queue. The system logs the player's entry into the queue, preparing them for the next available game slot. This event helps manage the order and availability of players.
- **ready-for-dungeon**: (Not used) Indicates a player is ready for the dungeon. This event would typically signal that the player has completed all necessary preparations, but it is not currently used in the system.
- **dungeon-ready**: The dungeon is ready for the player. The system assigns a dungeon instance to the player and notifies them that they can enter. This event ensures the player is directed to the correct game environment.
- **dungeon-closed**: The dungeon has been closed. This event logs the closure of the dungeon and updates the system to mark the instance as unavailable. It helps manage and free up resources for future use.
- **joined-network**: Indicates a player has connected to the lobby server. The system logs the player's connection and updates their network status. This event is crucial for tracking player presence and activity.
- **player-seen**: The player has been seen on the network. This event updates the last seen status of the player, useful for tracking player activity and ensuring accurate status updates.
- **card-visibility-updated**: The visibility of a card has been updated. The system logs the change in visibility, which may affect gameplay and player strategy. This event ensures all changes are tracked and reflected in the game state.
- **score-modified**: A player's score has been modified. This event updates the player's score in the system and may trigger notifications or updates to leaderboards. It is essential for maintaining accurate player rankings.

### Server Events
- **server-online**: The server has come online. The system logs the server's startup and makes it available for handling game sessions. This event is critical for monitoring server availability and performance.
- **server-closing**: The server is shutting down. This event logs the server's shutdown and ensures all active sessions are handled appropriately before termination. It helps prevent data loss and ensures a smooth shutdown process.
- **shutdown-all-empty-dungeons**: Shutdown all dungeons that are empty. The system checks for empty dungeon instances and shuts them down to free up resources. This event helps optimize resource usage and manage server load.

### Trade Events
- **trade-requested**: A trade has been requested. This event logs the trade request between players and initiates the trade process, ensuring all conditions are met before completion. It is essential for managing player interactions and transactions.

### Event Processing Summary
- **Create Event**: Logs the event in the system with all relevant details, such as player information, location, and metadata. This ensures comprehensive tracking of all activities and changes within the game.
- **Get Events**: Retrieves all logged events, with filtering options for admins to view specific events based on criteria like event name, player, or server. It provides a detailed history of all events for analysis and debugging.
- **Update Event**: Updates the details of a specific event, allowing corrections or additional information to be added. This feature ensures that event records remain accurate and up-to-date.
- **Delete Event**: Removes an event from the logs, ensuring it is no longer tracked or displayed in event queries. This helps manage the event log and remove outdated or irrelevant entries.

## Additional Information

For more details, see https://github.com/trackedout/internal-docs/blob/main/infra/README.md#components.

### Contributors

Thank you to all our contributors for your hard work and support!

<a href="https://github.com/trackedout/dunga-dunga-backend/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=trackedout/dunga-dunga-backend"/>
</a>
