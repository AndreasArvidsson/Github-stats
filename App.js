import Glyph from "owp.glyphicons";
import React, { useState, useEffect } from "react";
import DAO from "./DAO";

const dummy = false;

if (dummy) {
    DAO.setDummy();
}

const App = () => {
    const [username, setUsername] = useState("AndreasArvidsson");
    const [error, setError] = useState();
    const [rateLimit, setRateLimit] = useState();
    const [repos, setRepos] = useState([]);
    const [periods, setPeriods] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [sortBy, setSortBy] = useState(null);

    useEffect(() => {
        loadRateLimit();
    }, []);

    const doCatch = (error) => {
        console.error(error);
        setError(error);
        loadRateLimit();
        setIsLoading(false);
    };

    useEffect(() => {
        if (!rateLimit || !repos.length) {
            return;
        }
        if (dummy || repos.length <= rateLimit.remaining) {
            const promises = repos.map(repo =>
                DAO.getCodeFrequency(username, repo.name)
            );
            Promise.all(promises)
                .then(resList => {
                    const periods = {};
                    resList.forEach((res, i) => {
                        const repo = repos[i];
                        periods[repo.name] = calculatePeriods(res);
                    });
                    periods._sum = calculatePeriodsSum(periods);
                    setPeriods(periods);
                    loadRateLimit();
                    setIsLoading(false);
                })
                .catch(doCatch);
        }
        else {
            setError("Can't load code frequency due to rate limit");
            setPeriods({});
            setIsLoading(false);
        }
    }, [repos]);

    const loadRateLimit = () => {
        DAO.getRateLimit()
            .then(res => setRateLimit(res.resources.core))
            .catch(doCatch);
    }

    const loadData = () => {
        setRepos([]);
        setPeriods({});
        setIsLoading(true);

        DAO.getRateLimit()
            .then(res => {
                const rateLimit = res.resources.core;
                if (dummy || rateLimit.remaining) {
                    if (!dummy) {
                        rateLimit.remaining--;
                    }
                    DAO.getRepositories(username)
                        .then(setRepos)
                        .catch(doCatch);
                }
                else {
                    setError("Can't load repositories due to rate limit");
                    setIsLoading(false);
                }
                setRateLimit(rateLimit);
            })
            .catch(doCatch);
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
        const style = { marginTop: 20 };
        if (isLoading) {
            return <div style={style}>Loading...</div>;
        }

        if (sortBy !== null) {
            repos.sort((a, b) => {
                const pA = periods[a.name];
                const pB = periods[b.name];
                return pB[sortBy] - pA[sortBy];
            });
        }
        else {
            repos.sort((a, b) => {
                return a.name.localeCompare(b.name);
            });
        }

        return (
            <div style={style}>
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
                            <th onClick={() => setSortBy(null)}>Repositories ({repos.length})</th>
                            <th title="1 week" onClick={() => setSortBy(0)}>1 week</th>
                            <th title="4 weeks" onClick={() => setSortBy(1)}>1 month</th>
                            <th title="26 weeks" onClick={() => setSortBy(2)}>6 months</th>
                            <th title="52 weeks" onClick={() => setSortBy(3)}>1 year</th>
                            <th title="156 weeks" onClick={() => setSortBy(4)}>3 years</th>
                            <th title="All available weeks" onClick={() => setSortBy(5)}>Total</th>
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
            p = periods[repo.name];
        }
        //Sum row
        else {
            name = "Sum";
            p = periods._sum;
            bold = true;
        }
        if (!p) {
            p = new Array(numVals).fill("");
        }
        return (
            <tr key={name} style={bold ? { fontWeight: "bold" } : null}>
                <td>{name}</td>
                {p.map((val, i) =>
                    <td key={i}>{val}</td>
                )}
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

const numVals = 6;

function calculatePeriods(codeFreq) {
    const res = new Array(numVals);
    let sum = 0;
    if (codeFreq) {
        //Iterate over all weeks
        for (let i = 1; i <= codeFreq.length; ++i) {
            //Sumarize added lines. index 1 is added lines.
            sum += codeFreq[codeFreq.length - i][1];
            switch (i) {
                case 1:
                    res[0] = sum;
                    break;
                case 4:
                    res[1] = sum;
                    break;
                case 26:
                    res[2] = sum;
                    break;
                case 52:
                    res[3] = sum;
                    break;
                case 156:
                    res[4] = sum;
                    break;
            }
        }
    }
    for (let i = 0; i < res.length; ++i) {
        if (res[i] === undefined) {
            res[i] = sum;
        }
    }
    return res;
}

function calculatePeriodsSum(periods) {
    const res = new Array(numVals).fill(0);
    for (let i in periods) {
        const p = periods[i];
        for (let j = 0; j < p.length; ++j) {
            res[j] += p[j];
        }
    }
    return res;
}