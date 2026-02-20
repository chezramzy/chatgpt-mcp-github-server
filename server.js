import express from 'express';
import cors from 'cors';
import { Octokit } from 'octokit';

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration MCP
const PROTOCOL_VERSION = "2025-06-18";
const SERVER_NAME = "github-mcp";
const SERVER_VERSION = "1.0.0";

// GitHub Token (optionnel - peut être fourni par l'utilisateur)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Middleware
app.use(cors({
    origin: ['https://chatgpt.com', 'https://chat.openai.com', 'http://localhost:3000'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'MCP-Protocol-Version'],
    methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json());

// Initialiser Octokit si un token est fourni
let octokit;
if (GITHUB_TOKEN) {
    octokit = new Octokit({ auth: GITHUB_TOKEN });
}

// MCP Protocol Handler - ENDPOINT PRINCIPAL
app.post('/', (req, res) => {
    const { jsonrpc, method, params = {}, id } = req.body;

           try {
                 switch (method) {
                   case 'initialize':
                             res.json({
                                         jsonrpc: '2.0',
                                         id,
                                         result: {
                                                       protocolVersion: PROTOCOL_VERSION,
                                                       capabilities: {
                                                                       logging: {},
                                                                       prompts: { listChanged: false },
                                                                       resources: { listChanged: false },
                                                                       tools: { listChanged: false }
                                                       },
                                                       serverInfo: {
                                                                       name: SERVER_NAME,
                                                                       title: 'GitHub MCP Server',
                                                                       version: SERVER_VERSION
                                                       }
                                         }
                             });
                             break;

                   case 'initialized':
                             res.status(200).end();
                             break;

                   case 'tools/list':
                             res.json({
                                         jsonrpc: '2.0',
                                         id,
                                         result: {
                                                       tools: [
                                                         {
                                                                           name: 'search',
                                                                           title: 'Search GitHub',
                                                                           description: 'Search for repositories, users, or issues on GitHub',
                                                                           inputSchema: {
                                                                                               type: 'object',
                                                                                               properties: {
                                                                                                                     query: {
                                                                                                                                             type: 'string',
                                                                                                                                             description: 'Search query (repos, users, issues, etc)'
                                                                                                                       },
                                                                                                                     type: {
                                                                                                                                             type: 'string',
                                                                                                                                             enum: ['repositories', 'users', 'issues', 'code'],
                                                                                                                                             description: 'Type of search'
                                                                                                                       }
                                                                                                 },
                                                                                               required: ['query'],
                                                                                               additionalProperties: false
                                                                           }
                                                         },
                                                         {
                                                                           name: 'fetch',
                                                                           title: 'Fetch GitHub Data',
                                                                           description: 'Fetch data by ID (repo, user, issue)',
                                                                           inputSchema: {
                                                                                               type: 'object',
                                                                                               properties: {
                                                                                                                     id: {
                                                                                                                                             type: 'string',
                                                                                                                                             description: 'Owner/Repo format (e.g., "torvalds/linux")'
                                                                                                                       },
                                                                                                                     type: {
                                                                                                                                             type: 'string',
                                                                                                                                             enum: ['repository', 'user', 'issue'],
                                                                                                                                             description: 'Type of data to fetch'
                                                                                                                       }
                                                                                                 },
                                                                                               required: ['id', 'type'],
                                                                                               additionalProperties: false
                                                                           }
                                                         },
                                                         {
                                                                           name: 'get_user_repos',
                                                                           title: 'Get User Repositories',
                                                                           description: 'Get all repositories for a GitHub user',
                                                                           inputSchema: {
                                                                                               type: 'object',
                                                                                               properties: {
                                                                                                                     username: {
                                                                                                                                             type: 'string',
                                                                                                                                             description: 'GitHub username'
                                                                                                                       }
                                                                                                 },
                                                                                               required: ['username'],
                                                                                               additionalProperties: false
                                                                           }
                                                         },
                                                         {
                                                                           name: 'get_repo_info',
                                                                           title: 'Get Repository Info',
                                                                           description: 'Get detailed information about a repository',
                                                                           inputSchema: {
                                                                                               type: 'object',
                                                                                               properties: {
                                                                                                                     owner: {
                                                                                                                                             type: 'string',
                                                                                                                                             description: 'Repository owner'
                                                                                                                       },
                                                                                                                     repo: {
                                                                                                                                             type: 'string',
                                                                                                                                             description: 'Repository name'
                                                                                                                       }
                                                                                                 },
                                                                                               required: ['owner', 'repo'],
                                                                                               additionalProperties: false
                                                                           }
                                                         }
                                                                     ]
                                         }
                             });
                             break;

                   case 'tools/call':
                             handleToolCall(params, res, id);
                             break;

                   case 'resources/list':
                             res.json({
                                         jsonrpc: '2.0',
                                         id,
                                         result: {
                                                       resources: [],
                                                       nextCursor: null
                                         }
                             });
                             break;

                   default:
                             res.json({
                                         jsonrpc: '2.0',
                                         id,
                                         error: {
                                                       code: -32601,
                                                       message: 'Method not found'
                                         }
                             });
                 }
           } catch (error) {
                 console.error('Error:', error);
                 res.json({
                         jsonrpc: '2.0',
                         id,
                         error: {
                                   code: -32000,
                                   message: error.message
                         }
                 });
           }
});

// Gestionnaire d'appels d'outils
async function handleToolCall(params, res, id) {
    const { name, arguments: args = {} } = params;
    let content;

  try {
        switch (name) {
          case 'search':
                    content = await handleSearch(args);
                    break;

          case 'fetch':
                    content = await handleFetch(args);
                    break;

          case 'get_user_repos':
                    content = await handleGetUserRepos(args);
                    break;

          case 'get_repo_info':
                    content = await handleGetRepoInfo(args);
                    break;

          default:
                    return res.json({
                                jsonrpc: '2.0',
                                id,
                                error: {
                                              code: -32601,
                                              message: `Unknown tool: ${name}`
                                }
                    });
        }

      res.json({
              jsonrpc: '2.0',
              id,
              result: {
                        content: [{
                                    type: 'text',
                                    text: JSON.stringify(content, null, 2)
                        }],
                        isError: false
              }
      });
  } catch (error) {
        res.json({
                jsonrpc: '2.0',
                id,
                error: {
                          code: -32000,
                          message: error.message
                }
        });
  }
}

// Fonction de recherche
async function handleSearch(args) {
    const { query, type = 'repositories' } = args;

  // Mock data quand pas de token GitHub
  if (!octokit) {
        return {
                status: 'no_auth',
                message: 'GitHub authentication not configured. Returning sample data.',
                results: [
                  {
                              name: `Sample ${type} result for: ${query}`,
                              description: `This is a mock result. Connect your GitHub token for real data.`,
                              url: `https://github.com/search?q=${encodeURIComponent(query)}&type=${type}`
                  }
                        ]
        };
  }

  // Recherche réelle avec GitHub API
  try {
        const response = await octokit.rest.search.repos({
                q: query,
                per_page: 10,
                sort: 'stars',
                order: 'desc'
        });

      return {
              status: 'success',
              query,
              results: response.data.items.map(item => ({
                        name: item.full_name,
                        description: item.description,
                        url: item.html_url,
                        stars: item.stargazers_count,
                        language: item.language
              }))
      };
  } catch (error) {
        return {
                status: 'error',
                message: error.message
        };
  }
}

// Fonction de récupération
async function handleFetch(args) {
    const { id, type = 'repository' } = args;

  if (!octokit) {
        return {
                status: 'no_auth',
                message: `GitHub authentication required to fetch ${type}.`,
                id
        };
  }

  try {
        if (type === 'repository') {
                const [owner, repo] = id.split('/');
                const response = await octokit.rest.repos.get({ owner, repo });
                return {
                          status: 'success',
                          type: 'repository',
                          data: {
                                      name: response.data.full_name,
                                      description: response.data.description,
                                      url: response.data.html_url,
                                      stars: response.data.stargazers_count,
                                      forks: response.data.forks_count,
                                      language: response.data.language,
                                      topics: response.data.topics
                          }
                };
        } else if (type === 'user') {
                const response = await octokit.rest.users.getByUsername({ username: id });
                return {
                          status: 'success',
                          type: 'user',
                          data: {
                                      login: response.data.login,
                                      name: response.data.name,
                                      bio: response.data.bio,
                                      public_repos: response.data.public_repos,
                                      followers: response.data.followers,
                                      url: response.data.html_url
                          }
                };
        }
  } catch (error) {
        return {
                status: 'error',
                message: error.message
        };
  }
}

// Obtenir les repos d'un utilisateur
async function handleGetUserRepos(args) {
    const { username } = args;

  if (!octokit) {
        return {
                status: 'no_auth',
                message: 'GitHub authentication not configured.',
                username
        };
  }

  try {
        const response = await octokit.rest.repos.listForUser({
                username,
                per_page: 20,
                sort: 'stars',
                direction: 'desc'
        });

      return {
              status: 'success',
              username,
              count: response.data.length,
              repositories: response.data.map(repo => ({
                        name: repo.full_name,
                        description: repo.description,
                        url: repo.html_url,
                        stars: repo.stargazers_count,
                        language: repo.language
              }))
      };
  } catch (error) {
        return {
                status: 'error',
                message: error.message
        };
  }
}

// Obtenir les infos d'un repo
async function handleGetRepoInfo(args) {
    const { owner, repo } = args;

  if (!octokit) {
        return {
                status: 'no_auth',
                message: 'GitHub authentication not configured.',
                owner,
                repo
        };
  }

  try {
        const repoData = await octokit.rest.repos.get({ owner, repo });
        const contributors = await octokit.rest.repos.listContributors({
                owner,
                repo,
                per_page: 5
        });

      return {
              status: 'success',
              repository: {
                        name: repoData.data.full_name,
                        description: repoData.data.description,
                        url: repoData.data.html_url,
                        stars: repoData.data.stargazers_count,
                        forks: repoData.data.forks_count,
                        open_issues: repoData.data.open_issues_count,
                        language: repoData.data.language,
                        created_at: repoData.data.created_at,
                        updated_at: repoData.data.updated_at,
                        license: repoData.data.license?.name
              },
              top_contributors: contributors.data.map(c => ({
                        login: c.login,
                        contributions: c.contributions,
                        url: c.html_url
              }))
      };
  } catch (error) {
        return {
                status: 'error',
                message: error.message
        };
  }
}

// Health check
app.get('/', (req, res) => {
    res.json({
          name: SERVER_NAME,
          version: SERVER_VERSION,
          protocol: PROTOCOL_VERSION,
          status: 'running',
          github_authenticated: !!GITHUB_TOKEN
    });
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 MCP Server running on port ${PORT}`);
    console.log(`📝 Protocol: MCP ${PROTOCOL_VERSION}`);
    console.log(`🔐 GitHub Authenticated: ${!!GITHUB_TOKEN}`);
    console.log(`✅ Ready for ChatGPT integration!`);
});
