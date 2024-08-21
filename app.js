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

async function getRepoUrl(git) {
  if (!selectedRepo) {
    return undefined;
  }

  try {
    // Obtenha a URL remota configurada para 'origin'
    const config = await git.getConfig("remote.origin.url");
    let remoteUrl = config.value;

    if (remoteUrl.startsWith("git@")) {
      if (remoteUrl.includes("ssh.dev.azure.com")) {
        // SSH Azure DevOps
        remoteUrl = remoteUrl
          .replace("git@ssh.dev.azure.com:v3/", "https://dev.azure.com/")
          .replace(".git", "");
      } else {
        // others SSH (GitHub, GitLab, Bitbucket, etc)
        remoteUrl = remoteUrl
          .replace(":", "/")
          .replace(/^git@[^:]+:/, "https://")
          .replace(".git", "");
      }
    } else if (remoteUrl.startsWith("https://")) {
      // HTTPS
      remoteUrl = remoteUrl.replace(".git", "");
    }

    console.log(`Repository URL: ${remoteUrl}`);
    return remoteUrl;
  } catch (err) {
    console.error("Failed to get repository URL:", err);
    return undefined;
  }
}

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
        await git.fetch(["--prune"]);
        const branches = await git.branch(["-r"]);

        const allBranches = branches.all.map((b) => b.replace("origin/", ""));

        if (allBranches.length === 0) {
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
                  options: allBranches.map((branch) => ({
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

        const branches = await git.branch(["-a"]);
        const localBranches = branches.all.filter(
          (b) => !b.startsWith("remotes/origin/"),
        );
        const remoteBranches = branches.all
          .filter((b) => b.startsWith("remotes/origin/"))
          .map((b) => b.replace("remotes/", ""))
          .filter((b) => b !== "origin/HEAD")
          .filter((b) => !localBranches.includes(b.replace("origin/", "")));

        console.log("branches:", [...localBranches, ...remoteBranches]);

        if (branches.current !== branchName) {
          if (!localBranches.includes(branchName)) {
            await git.checkout(["-b", branchName, `origin/${branchName}`]);
          } else {
            await git.checkout(branchName);
          }
        }

        console.log("start pulling", branches.current, branchName);
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
        console.log("logs", logs.total);

        let formattedMessage;

        if (logs.all.length === 0) {
          formattedMessage = `No logs found in the last 24 hours for **${selectedRepo.name}** on branch *${branchName}*`;
        } else {
          const logsByAuthor = logs.all.reduce((acc, log) => {
            if (!acc[log.author_name]) {
              acc[log.author_name] = [];
            }

            // limit to 5 logs per author
            // if (acc[log.author_name].length >= 5) {
            //   return acc;
            // }

            acc[log.author_name].push(log);
            return acc;
          }, {});

          formattedMessage = `
            # Daily - ${selectedRepo.name} (branch: *${branchName}*)
    
            ${Object.keys(logsByAuthor)
              .map((author) => {
                return `## ${author}\n${logsByAuthor[author]
                  .map((log) => {
                    return `\t- ** ${moment(log.date).format("DD/MM HH:mm")}**: ${log.message.length > 50 ? log.message.slice(0, 50) + "..." : log.message}`;
                  })
                  .join("\n")}`;
              })
              .join("\n")}
          `;
        }

        const charLimit = 1900;
        if (formattedMessage.length > charLimit) {
          const repoUrl = await getRepoUrl(git);
          if (repoUrl) {
            formattedMessage = `${formattedMessage.slice(0, charLimit)}\n[See More](${repoUrl})`;
          } else {
            formattedMessage = `${formattedMessage.slice(0, charLimit)}\n\n*The full report is too long to display here*`;
          }
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
