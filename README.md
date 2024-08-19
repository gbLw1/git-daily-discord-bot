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

4. **Register the commands**

   ```bash
   npm run register
   ```

5. **Start the bot**

   ```bash
   npm run start
   ```

---

## Commands

```bash
/dailyfrom <repository> <branch> <date>
```

- **repository:** The repository name

  - The repository must be set in the `.repositories.json` file
  - If it's a private repository, you must set the `token` key in the `.repositories.json` file, e.g.:

    ```json
    {
      "repository": {
        "url": "your-repository",
        "token": "access-token"
      }
    }
    ```

  - At this point this is just written by copilot so, this is not a real thing and i'll probably do this in some other way like `.env` file or something like that

- **branch:** The branch name (default: dev)
- **date:** The date to show the commits (default: last 24 hours)
  - Format: YYYY-MM-DD
  - If you input a date, the bot will show the commits from that date (00:00:00) to the end of the day (23:59:59)
