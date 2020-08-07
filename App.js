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

    useEffect(() => {
        loadRateLimit();
    }, []);

    const doCatch = (error) => {
        console.error(error);
        setError(error);
        setIsLoading(false);
    };

    useEffect(() => {
        if (!rateLimit || !repos.length) {
            return;
        }
        if (dummy || repos.length <= rateLimit.remaining) {
            if (!dummy) {
                rateLimit.remaining -= repos.length;
                setRateLimit({ ...rateLimit });
            }
            const promises = repos.map(repo =>
                DAO.getCodeFrequency(username, repo.name)
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
            .then(res => {
                setRateLimit(res.resources.core);
            })
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
                            <th>Repositories ({repos.length})</th>
                            <th title="1 week">1 week</th>
                            <th title="4 weeks">1 month</th>
                            <th title="26 weeks">6 months</th>
                            <th title="52 weeks">1 year</th>
                            <th title="156 weeks">3 years</th>
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
                <td>{p.threeYears}</td>
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
    let sum = 0;
    if (codeFreq && codeFreq.length) {
        const maxDuration = Math.min(codeFreq.length, 156);
        //Iterate over all weeks
        for (let i = 1; i <= maxDuration; ++i) {
            //Sumarize added lines. index 1 is added lines.
            sum += codeFreq[codeFreq.length - i][1];
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
                case 52:
                    res.year = sum;
                    break;
                case 156:
                    res.threeYears = sum;
                    break;
            }
        }
    }
    if (res.threeYears === undefined) {
        res.threeYears = sum;
    }
    if (res.year === undefined) {
        res.year = sum;
    }
    if (res.halfYear === undefined) {
        res.halfYear = sum;
    }
    if (res.month === undefined) {
        res.month = sum;
    }
    if (res.week === undefined) {
        res.week = sum;
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