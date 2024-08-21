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
import { repos } from "./repos.js";

const app = express();
const PORT = process.env.PORT || 3000;

let selectedRepo = null;

function updateOriginalMessage(token, args) {
  return fetch(
    `https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: args.content,
        components: args.components,
      }),
    },
  );
}

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
                  custom_id: `repo_${repo.name}`,
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
      const { custom_id, values } = data;

      // SELECTED REPO
      if (custom_id.startsWith("repo_")) {
        const repoName = custom_id.replace("repo_", "");
        const repo = repos.find((repo) => repo.name === repoName);

        if (!repo) {
          console.error("unknown repository");
          return res.status(400).json({ error: "unknown repository" });
        }

        selectedRepo = repo;

        // Start loading
        res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });

        const git = simpleGit(repo.url);
        await git.fetch(["--all"]);
        const branches = await git.branch(["-a"]);
        const remoteBranches = branches.all.filter((b) =>
          b.includes("remotes/origin/"),
        );
        const localBranches = branches.all.filter(
          (b) => !b.includes("remotes/"),
        );

        // all branches (removing duplicates)
        const branchButtons = [
          ...localBranches,
          ...remoteBranches.map((b) => b.replace("remotes/origin/", "")),
        ].filter((branch, index, self) => self.indexOf(branch) === index);

        if (branchButtons.length === 0) {
          await updateOriginalMessage(req.body.token, {
            content: `No branches found in the repository ${repo.name}`,
          });

          return;
        }

        await updateOriginalMessage(req.body.token, {
          content: `Select a branch to get the daily report from`,
          components: [
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.STRING_SELECT,
                  placeholder: "Select a branch",
                  custom_id: "branch_",
                  options: branchButtons.map((branch) => ({
                    label: branch,
                    value: branch,
                  })),
                },
              ],
            },
          ],
        });

        return;
      }

      // SELECTED BRANCH
      if (custom_id.startsWith("branch_")) {
        const branchName = values[0];
        if (!selectedRepo) {
          return res.status(400).json({ error: "no repository selected" });
        }

        // Send an initial response immediately (kind of a "loading" message)
        res.send({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        });

        const git = simpleGit(selectedRepo.url);

        // List all branches (local and remote)
        const branches = await git.branch(["-a"]);

        const localBranches = branches.all.filter(
          (b) => !b.includes("remotes/"),
        );
        const remoteBranches = branches.all.filter((b) =>
          b.includes("remotes/origin/"),
        );

        const branchExistsLocally = localBranches.includes(branchName);
        const branchExistsRemotely = remoteBranches.includes(
          `remotes/origin/${branchName}`,
        );

        if (!branchExistsLocally && !branchExistsRemotely) {
          updateOriginalMessage(req.body.token, {
            content: `The branch "${branchName}" does not exist in the repository ${selectedRepo.name}`,
          });
          return;
        }

        if (!branchExistsLocally && branchExistsRemotely) {
          await git.checkout(["-b", branchName, `origin/${branchName}`]);
        } else if (branchExistsLocally) {
          await git.checkout(branchName);
        }

        try {
          await git.pull();
        } catch (err) {
          await updateOriginalMessage(req.body.token, {
            content: `Failed to pull the latest changes for the branch *${branchName}*. Error: ${err.message}`,
          });
          return;
        }

        const logs = await git.log({
          "--since": "24 hours ago",
        });

        let formattedMessage;

        if (logs.all.length === 0) {
          formattedMessage = `No logs found in the last 24 hours for **${selectedRepo.name}** on branch *${branchName}*`;
        } else {
          const logsByAuthor = logs.all.reduce((acc, log) => {
            if (!acc[log.author_name]) {
              acc[log.author_name] = [];
            }
            acc[log.author_name].push(log);
            return acc;
          }, {});

          formattedMessage = `
            # Daily - ${selectedRepo.name} (branch: *${branchName}*)
    
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
        }

        // Edit the original response with the actual content
        await updateOriginalMessage(req.body.token, {
          content: formattedMessage,
        });
        selectedRepo = null;
        return;
      }
    }

    console.error("unknown interaction type", type, data);
  },
);

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
