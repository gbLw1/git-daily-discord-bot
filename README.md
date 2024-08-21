# Discord BOT

## Description

This is a discord bot that shows the last 24 hours Git commits of a repository.

## How to use

1. **Clone the repository**

2. **Install the dependencies**

   ```bash
   npm install
   ```

3. **Set the environment variables**

   Just rename the `.env.sample` file to `.env` and fill the variables with the correct values (you can get all the values from the [Discord Developer Portal](https://discord.com/developers/applications))

4. **Clone your repositories**

   The bot will search for the repositories in the `repos` folder, so clone your repositories there and make sure to map those repositories correctly in the `repos` const in the [app.js](app.js) file

5. **Register the commands**

   ```bash
   npm run register
   ```

6. **Start the bot**

   ```bash
   npm run start
   ```

---

## Commands

```bash
/daily-report <repository>
```

- **repository:** Select a repository from the list

  - The repository must be cloned in the same directory as the bot (the bot will search for the repository in the `repos` folder)

- **branch:** Select a branch from the list

