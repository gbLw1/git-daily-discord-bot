# Discord BOT

## Description

This is a discord bot that shows the last 24 hours Git commits of a repository.

## How to use

1. **Install the dependencies**

   ```bash
   npm install
   ```

2. **Set the environment variables**

   Just rename the `.env.sample` file to `.env` and fill the variables with the correct values (you can get all the values from the [Discord Developer Portal](https://discord.com/developers/applications))

   - **APP_ID:** The ID of the application (you can get it from the General Information section)
   - **DISCORD_TOKEN:** The token of the bot (you can get it from the bot section)
   - **PUBLIC_KEY:** The public key of the application (you can get it from the General Information section)

3. **Clone the repositories**

   You need to clone the repositories you want to log because the bot will use your git credentials to fetch the commits. To do that:

   - Create a `repos` folder in the root of the project
   - Clone your repositories inside the `repos` folder
   - Map your repositories in the [repos.js](repos.js) file

4. **Register the commands**

   Create the commands in the Discord API, make sure to set the `INTERACTIONS ENDPOINT URL` in the General Information section to some public URL (like [ngrok](https://ngrok.com/) or something similar to expose your local server to the internet) and run the following command:

   ```bash
   npm run register
   ```

5. **Start the bot**

   There you have it, just start the bot and you're good to go!

   ```bash
   npm run start
   ```

---

## Commands

Basically, the bot has only one command, which will ask you to select a repository and a branch to show the last 24 hours commits.

```bash
/daily-report
```

- **repository:** Select a repository from the list
  - The bot will search for the repositories in the `repos` folder, so make sure to clone your repositories there and have them mapped in the [repos.js](repos.js) file

- **branch:** Select a branch from the list
  - The branches will be automagically fetched from the repository, so you don't need to worry about having it locally
  - After selecting, the bot will checkout to that branch and pull the latest changes
