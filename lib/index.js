// Copyright the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.

const https = require('https');
const process = require('process');
const got = require('got');

if ((!process.env.USER_ID) || (!process.env.USER_PASSWORD)) {
  console.log('You must set USER_ID and USER_PASSWORD in the environment');
  process.exit(0);
}

const userId = process.env.USER_ID;
const userPassword = process.env.USER_PASSWORD;

// get the list of repos for an org, page by page
// returns the repos on the page listed
// we use basic authentication as the rate limiting
// is less restrictive if you are logged in.
async function getRepoList(org, page) {
  const result = new Promise((resolve, reject) => {
    const requestOptions = { hostname: 'api.github.com',
                             port: 443,
                             path: `/orgs/${org}/repos?page=${page}`,
                             method: 'GET',
                             headers: { 'User-Agent': 'Node.js request',
                                        'Authorization': 'Basic ' + new Buffer(`${userId}:${userPassword}`).toString('base64') }};
    https.request(requestOptions, (res) => {
      let responseData = '';
      res.on('data', data =>  {
        responseData = responseData += data;
      });

      res.on('end', () => {
        resolve(responseData);
      });
    }).end();
  });

  return result;
}

// iterate over the repos for the org specified
// checking each repo that was a wiki to make
// sure it is not editable (assumes userid/password
// provided in environment is for a github user
// that is NOT a member of the org
async function checkRepos(org) {
  let repo = 1;
  let page = 1;
  let failed = false;

  while(true) {
    const repoList = await getRepoList(org, page);
    const repoListObject = JSON.parse(repoList);
    if (repoListObject.length != 0) {
      for (entry in repoListObject) {
        const curEntry = repoListObject[entry];
        if (curEntry.archived === false) {
	  const travisUrl = `https://raw.githubusercontent.com/${org}/${curEntry.name}/HEAD/.travis.yml`
	  try {
	    const response = await got(travisUrl);
	    if (response) {
              console.log('====================================================================');
	      console.log('REPO:' + curEntry.name);
              console.log('--');
	      console.log(response.body);
              console.log('====================================================================');
            }
          } catch (error) {
	  }
          repo++;
	}
      }
    } else {
      break;
    }
    page++;
  }
  return(failed);
}


// start checking all of the repos
checkRepos('nodejs').catch( e => {
  console.log(e);
  process.exit(-2);
}).then((result) => {
  if (result) {
    // at least one of the repositories had an editable wiki
    process.exit(-1);
  }
});

