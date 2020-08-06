import HTTP from "owp.http";
import dummyRepos from "./dummyRepos";
import dummyCodeFreq from "./dummyCodeFreq";

let dummy = false;

export default {

    setDummy: function () {
        dummy = true;
    },

    getRateLimit: function () {
        return get("https://api.github.com/rate_limit");
    },

    getRepositories: function (user) {
        if (dummy) {
            return Promise.resolve(dummyRepos);
        }
        return get(`https://api.github.com/users/${user}/repos`);
    },

    //Get the weekly commit activity
    //Returns a weekly aggregate of the number of additions and deletions pushed to a repository.
    getCodeFrequency: function (user, repo) {
        if (dummy) {
            if (dummyCodeFreq[repo]) {
                return Promise.resolve(dummyCodeFreq[repo]);
            }
            return Promise.reject("Can't find dummy for repo: " + repo);
        }
        return get(`https://api.github.com/repos/${user}/${repo}/stats/code_frequency`);
    }

};

function get(url) {
    return new Promise((resolve, reject) => {
        tryGet(url, resolve, reject);
    });
}

function tryGet(url, resolve, reject, waitTime) {
    HTTP.get(url, { fullResponse: true })
        .then(res => {
            if (res.statusCode !== 202) {
                resolve(res.data);
            }
            //If response is 202 then wait and try again.
            else {
                waitTime = waitTime || 1000;
                console.log(202, url, "Waiting for: ", waitTime)
                setTimeout(() => {
                    tryGet(url, resolve, reject, waitTime * 2);
                }, waitTime);
            }
        })
        .catch(reject);
}

//Get the last year of commit activity
//Returns the last year of commit activity grouped by week. The days array is a group of commits per day, starting on Sunday.
// function getCommits(user, repo) {
//     return HTTP.get(`https://api.github.com/repos/${user}/${repo}/stats/commit_activity`);
// }