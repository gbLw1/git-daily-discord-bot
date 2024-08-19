import "dotenv/config";
import express from "express";
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
  MessageComponentTypes,
  ButtonStyleTypes,
} from "discord-interactions";
import { simpleGit } from "simple-git";
import moment from "moment";

const app = express();
const PORT = process.env.PORT || 3000;

// List of repositories to get daily reports from
// make sure the repository is cloned in the same directory as this app
const repos = [
  {
    name: "MyProject",
    url: "./repos/MyRepoFolder",
  },
];

app.post(
  "/interactions",
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  async function (req, res) {
    const { type, data } = req.body;

    if (type === InteractionType.PING) {
      return res.send({ type: InteractionResponseType.PONG });
    }

    /**
     * Handle slash command requests
     * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
     */
    if (type === InteractionType.APPLICATION_COMMAND) {
      const { name } = data;

      if (name === "daily-report") {
        const context = req.body.context;
        const userId =
          context === 0 ? req.body.member.user.id : req.body.user.id;

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `Hello <@${userId}>, select a repository to get the daily report from`,
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: repos.map((repo) => ({
                  type: MessageComponentTypes.BUTTON,
                  label: repo.name,
                  style: ButtonStyleTypes.PRIMARY,
                  custom_id: repo.name,
                })),
              },
            ],
          },
        });
      }

      console.error(`unknown command: ${name}`);
      return res.status(400).json({ error: "unknown command" });
    }

    // Handle message component interactions
    if (type === InteractionType.MESSAGE_COMPONENT) {
      const { custom_id } = data;

      const repo = repos.find((repo) => repo.name === custom_id);
      if (!repo) {
        return res.status(400).json({ error: "unknown repository" });
      }

      const git = simpleGit(repo.url);
      const branches = await git.branchLocal();

      // if (branches.current !== "dev") {
      //   await git.checkout("dev", (err, update) => {
      //     if (err) {
      //       console.error('error checking out "dev" branch', err);
      //     }
      //     console.log('checked out "dev" branch', update);
      //   });
      // }

      // await git.pull((err, update) => {
      //   if (err) {
      //     console.error("error pulling", err);
      //   }
      //   console.log("pulled", update);
      // });

      // TODO: find a way to pull before getting logs
      // the discord api has a 3 second timeout for responses
      // and pulling can take longer than that

      const logs = await git.log({
        // maxCount: 30,
        "--since": "24 hours ago",
      });

      if (logs.all.length === 0) {
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `No logs found in the last 24 hours for ${repo.name}`,
          },
        });
      }

      // distinct by author_name
      const logsByAuthor = logs.all.reduce((acc, log) => {
        if (!acc[log.author_name]) {
          acc[log.author_name] = [];
        }

        acc[log.author_name].push(log);
        return acc;
      }, {});

      const formattedMessage = `
            # Daily - ${repo.name} (*branch: ${branches.current}*)
    
            ${Object.keys(logsByAuthor)
              .map((author) => {
                return `## ${author}\n${logsByAuthor[author]
                  .map((log) => {
                    return `\t- ** ${moment(log.date).format("DD/MM/YY HH:mm:ss")}**: ${log.message}`;
                  })
                  .join("\n")}`;
              })
              .join("\n")}
            `;

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: formattedMessage,
        },
      });
    }

    console.error("unknown interaction type", type);
    return res.status(400).json({ error: "unknown interaction type" });
  },
);

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
