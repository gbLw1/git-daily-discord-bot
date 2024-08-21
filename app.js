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

    if (type === InteractionType.MESSAGE_COMPONENT) {
      const { custom_id } = data;
      const repo = repos.find((repo) => repo.name === custom_id);

      if (!repo) {
        console.error("unknown repository");
        return res.status(400).json({ error: "unknown repository" });
      }

      // Send an initial response immediately
      res.send({
        type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      });

      const git = simpleGit(repo.url);
      const branches = await git.branchLocal();

      await git.checkout("dev");
      await git.pull();

      const logs = await git.log({
        // maxCount: 10,
        "--since": "24 hours ago",
      });

      let formattedMessage;

      if (logs.all.length === 0) {
        formattedMessage = `No logs found in the last 24 hours for ${repo.name}`;
      } else {
        const logsByAuthor = logs.all.reduce((acc, log) => {
          if (!acc[log.author_name]) {
            acc[log.author_name] = [];
          }
          acc[log.author_name].push(log);
          return acc;
        }, {});

        formattedMessage = `
          # Daily - ${repo.name} (*branch: ${branches.current}*)
  
          ${Object.keys(logsByAuthor)
            .map((author) => {
              return `## ${author}\n${logsByAuthor[author]
                .map((log) => {
                  return `\t- ** ${moment(log.date).format(
                    "DD/MM/YY HH:mm:ss",
                  )}**: ${log.message}`;
                })
                .join("\n")}`;
            })
            .join("\n")}
        `;
      }

      // Edit the original response with the actual content
      await fetch(
        `https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: formattedMessage,
          }),
        },
      );

      return; // Ensure the function ends here and doesn't try to send another response
    }

    console.error("unknown interaction type", type);
  },
);

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
