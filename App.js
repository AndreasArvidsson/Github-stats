import HTTP from "owp.http";
import Glyph from "owp.glyphicons";
import React, { useState, useEffect } from "react";
import dummyRepos from "./dummyRepos";
import dummyCodeFreq from "./dummyCodeFreq";

const dummy = false;

const App = () => {
    const [username, setUsername] = useState("AndreasArvidsson");
    const [error, setError] = useState();
    const [rateLimit, setRateLimit] = useState();
    const [repos, setRepos] = useState([]);
    const [periods, setPeriods] = useState({});

    useEffect(() => {
        loadRateLimit();
    }, []);

    useEffect(() => {
        if (!rateLimit || !repos.length) {
            return;
        }
        if (dummy || repos.length <= rateLimit.remaining) {
            if (!dummy) {
                rateLimit.remaining -= repos.length;
            }
            setRateLimit({ ...rateLimit });
            const promises = repos.map(repo =>
                getCodeFrequency(username, repo.name)
            );
            Promise.all(promises)
                .then(res => {
                    const periods = {};
                    res.forEach((cf, i) => {
                        const repo = repos[i];
                        periods[repo.name] = calculatePeriods(cf);
                    });
                    periods._sum = calculatePeriodsSum(periods);
                    setPeriods(periods);
                })
                .catch(console.error);
        }
        else {
            setError("Can't load code frequency due to rate limit");
            setPeriods({});
        }
    }, [repos]);

    const loadRateLimit = () => {
        getRateLimit()
            .then(res => {
                setRateLimit(res.resources.core);
            })
            .catch(console.error);
    }

    const loadData = () => {
        setRepos([]);
        setPeriods({});

        getRateLimit()
            .then(res => {
                const rateLimit = res.resources.core;
                if (dummy || rateLimit.remaining) {
                    if (!dummy) {
                        rateLimit.remaining--;
                    }
                    getRepositories(username)
                        .then(setRepos)
                        .catch(console.error);
                }
                else {
                    setError("Can't load repositories due to rate limit");
                }
                setRateLimit(rateLimit);
            })
            .catch(console.error);
    }

    const renderRateLimit = () => {
        if (!rateLimit) {
            return null;
        }
        const d = new Date(rateLimit.reset * 1000);
        return (
            <div>
                <hr />
                <h3>
                    Rate limit: &nbsp;
                    <small>
                        {rateLimit.remaining} / {rateLimit.limit}
                        &nbsp;
                        <Glyph type="refresh" onClick={loadRateLimit} />
                    </small>
                </h3>
                {rateLimit.remaining < rateLimit.limit &&
                    <React.Fragment>
                        Resets at: {d.toString()}
                    </React.Fragment>
                }
                <hr />
            </div>
        );
    }

    const renderError = () => {
        if (!error) {
            return null;
        }

        return (
            <div className="alert alert-danger" role="alert">
                <h3>{error}</h3>
            </div>
        );
    }

    const renderControls = () => {
        return (
            <div>
                <input
                    type="text"
                    placeholder="username"
                    value={username} onChange={e => setUsername(e.target.value)}
                />
            &nbsp;
                <button onClick={loadData}>
                    Load data
                </button>
            </div>
        );
    }

    const renderRepos = () => {
        return (
            <div style={{ marginTop: 20 }}>
                <table className="table table-striped">
                    <thead className="thead-dark">
                        <tr>
                            <td></td>
                            <td colSpan="3" style={{ textAlign: "center" }}>
                                <i>Number of lines of code added</i>
                            </td>
                            <td></td>
                        </tr>
                        <tr>
                            <th>Repositories ({repos.length})</th>
                            <th>1 week</th>
                            <th>1 month</th>
                            <th>6 months</th>
                            <th>1 year</th>
                        </tr>
                    </thead>
                    <tbody>
                        {repos.map(renderRepo)}
                        {renderRepo()}
                    </tbody>
                </table>
                <hr />
            </div>
        );
    }

    const renderRepo = (repo) => {
        let name, p, bold;
        if (repo) {
            name = repo.name;
            p = periods[repo.name] || {};
        }
        //Sum row
        else {
            name = "Sum";
            p = periods._sum || {};
            bold = true;
        }
        return (
            <tr key={name} style={bold ? { fontWeight: "bold" } : null}>
                <td>{name}</td>
                <td>{p.week}</td>
                <td>{p.month}</td>
                <td>{p.halfYear}</td>
                <td>{p.year}</td>
            </tr>
        );
    }

    return (
        <React.Fragment>
            <h1>Github stats</h1>
            {renderRateLimit()}
            {renderError()}
            {renderControls()}
            {renderRepos()}
        </React.Fragment>
    );
};

export default App;

function calculatePeriods(codeFreq) {
    const res = {};
    if (codeFreq && codeFreq.length) {
        //Iterate max one year
        const maxDuration = Math.min(codeFreq.length, 52) - 1;
        let sum = 0;
        for (let i = 0; i <= maxDuration; ++i) {
            const index = codeFreq.length - i - 1;
            //Sumarize added lines.
            sum += codeFreq[index][1];
            switch (i) {
                case 1:
                    res.week = sum;
                    break;
                case 4:
                    res.month = sum;
                    break;
                case 26:
                    res.halfYear = sum;
                    break;
                case maxDuration:
                    res.year = sum;
                    if (res.halfYear === undefined) {
                        res.halfYear = sum;
                    }
                    if (res.month === undefined) {
                        res.month = sum;
                    }
                    if (res.week === undefined) {
                        res.week = sum;
                    }
                    break;
            }
        }
    }
    return res;
}

function calculatePeriodsSum(periods) {
    const res = {};
    for (let i in periods) {
        const p = periods[i];
        for (let field in p) {
            const value = p[field];
            if (res[field] === undefined) {
                res[field] = value;
            }
            else {
                res[field] += value;
            }
        }
    }
    return res;
}

function getRateLimit() {
    return HTTP.get("https://api.github.com/rate_limit");
}

function getRepositories(user) {
    if (dummy) {
        return Promise.resolve(dummyRepos);
    }
    return HTTP.get(`https://api.github.com/users/${user}/repos`);
}

//Get the weekly commit activity
//Returns a weekly aggregate of the number of additions and deletions pushed to a repository.
function getCodeFrequency(user, repo) {
    if (dummy) {
        if (dummyCodeFreq[repo]) {
            return Promise.resolve(dummyCodeFreq[repo]);
        }
        return Promise.reject("Can't find dummy for repo: " + repo);
    }
    return HTTP.get(`https://api.github.com/repos/${user}/${repo}/stats/code_frequency`);
}
//https://api.github.com/repos/AndreasArvidsson/LuaMongo/stats/code_frequency

//Get the last year of commit activity
//Returns the last year of commit activity grouped by week. The days array is a group of commits per day, starting on Sunday.
// function getCommits(user, repo) {
//     return HTTP.get(`https://api.github.com/repos/${user}/${repo}/stats/commit_activity`);
// }

