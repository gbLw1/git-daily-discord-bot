/**
 * @typedef {Object} Repo
 * @property {string} name - The name of the repository.
 * @property {string} url - The local path to the repository.
 */

/**
 * List of repositories to get daily reports from.
 * @type {Repo[]}
 */
export const repos = [
  { name: "MyProject", url: "./repos/MyProject" },
];
