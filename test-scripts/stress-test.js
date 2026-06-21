import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const voteSuccess = new Counter("votes_success");
const voteFail = new Counter("votes_fail");
const alreadyVoted = new Counter("votes_already_cast");
const voteSuccessRate = new Rate("vote_success_rate");
const voteDuration = new Trend("vote_flow_duration_ms", true);

const API_URL = __ENV.API_URL || "http://nginx/api";
const BASE_URL = API_URL.replace(/\/api$/, "");
const VOTING_NAME = "Stress Voting Event";
const PASSWORD = "Password123!";
const TOTAL_USERS = 50000;

export const options = {
  scenarios: {
    voting_load: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: "60m", target: 5 },
        { duration: "157m", target: 5 },
        { duration: "2m", target: 15 },
        { duration: "3m", target: 5 },
        { duration: "157m", target: 5 },
        { duration: "2m", target: 15 },
        { duration: "3m", target: 5 },
        { duration: "157m", target: 5 },
        { duration: "2m", target: 15 },
        { duration: "3m", target: 5 },
        { duration: "157m", target: 5 },
        { duration: "2m", target: 15 },
        { duration: "3m", target: 5 },
        { duration: "30m", target: 0 },
      ],
      exec: "voteScenario",
    },
  },

  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<5000"],
    vote_success_rate: ["rate>0.80"],
    vote_flow_duration_ms: ["p(95)<15000"],
  },
};

function safeBody(res) {
  return res && res.body ? res.body : "(no body)";
}

function randSleep() {
  return Math.random() * 3 + 1;
}

function buildJar(loginRes) {
  var jar = http.cookieJar();
  var rawCookies = loginRes.cookies || {};
  var keys = Object.keys(rawCookies);
  var count = 0;
  for (var i = 0; i < keys.length; i++) {
    var list = rawCookies[keys[i]];
    if (Array.isArray(list) && list.length > 0) {
      jar.set(BASE_URL, keys[i], list[0].value);
      count++;
    }
  }
  return count > 0 ? jar : null;
}

function login(email) {
  var res = http.post(
    API_URL + "/auth/login",
    JSON.stringify({ email: email, password: PASSWORD, rememberMe: false }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (res.status !== 200) return null;
  return buildJar(res);
}

export function setup() {
  console.log("setup: logging in as seed owner...");

  var loginRes = http.post(
    API_URL + "/auth/login",
    JSON.stringify({
      email: "owner1@example.com",
      password: PASSWORD,
      rememberMe: false,
    }),
    { headers: { "Content-Type": "application/json" } },
  );

  if (loginRes.status !== 200) {
    throw new Error(
      "setup: login failed status=" +
        loginRes.status +
        " body=" +
        safeBody(loginRes),
    );
  }

  var jar = buildJar(loginRes);
  if (!jar) throw new Error("setup: login returned no cookies");

  var votingsRes = http.get(API_URL + "/votings", {
    headers: { "Content-Type": "application/json" },
    jar: jar,
  });

  if (votingsRes.status !== 200) {
    throw new Error(
      "setup: GET /votings failed status=" +
        votingsRes.status +
        " body=" +
        safeBody(votingsRes),
    );
  }

  var votings;
  try {
    votings = votingsRes.json();
  } catch (e) {
    throw new Error("setup: bad /votings JSON body=" + safeBody(votingsRes));
  }

  if (!Array.isArray(votings) || votings.length === 0) {
    throw new Error("setup: no votings returned — is the DB seeded?");
  }

  var target = null;
  for (var j = 0; j < votings.length; j++) {
    var v = votings[j];
    if (
      v.title === VOTING_NAME &&
      v.isPublic === true &&
      v.isFinalized === false
    ) {
      target = v;
      break;
    }
  }

  if (!target) {
    throw new Error(
      'setup: "' +
        VOTING_NAME +
        '" not found. Available: ' +
        votings
          .map(function (v) {
            return '"' + v.title + '"';
          })
          .join(", "),
    );
  }

  if (!target.options || target.options.length === 0) {
    throw new Error('setup: voting "' + VOTING_NAME + '" has no options');
  }

  var optionIds = target.options.map(function (o) {
    return o.id;
  });

  console.log("setup: found votingId=" + target.id);
  console.log(
    "setup: options=" +
      target.options
        .map(function (o) {
          return '"' + o.text + '" (' + o.id + ")";
        })
        .join(", "),
  );

  return {
    votingId: target.id,
    optionIds: optionIds,
  };
}

export function voteScenario(data) {
  var votingId = data.votingId;
  var optionIds = data.optionIds;

  var maxVUs = 500;
  var userNum = (Math.random() < 0.2)
    ? Math.floor(Math.random() * TOTAL_USERS)
    : (__VU - 1 + __ITER * maxVUs) % TOTAL_USERS;
  var email = "stress_user_" + userNum + "@demo.local";
  var flowStart = Date.now();

  var loginRes = http.post(
    API_URL + "/auth/login",
    JSON.stringify({ email: email, password: PASSWORD, rememberMe: false }),
    { headers: { "Content-Type": "application/json" } },
  );

  if (
    !check(loginRes, {
      "login 200": function (r) {
        return r.status === 200;
      },
    })
  ) {
    console.error(
      "login failed user=" +
        userNum +
        " status=" +
        loginRes.status +
        " body=" +
        safeBody(loginRes).slice(0, 150),
    );
    voteSuccessRate.add(false);
    sleep(randSleep());
    return;
  }

  var jar = buildJar(loginRes);
  if (!jar) {
    voteSuccessRate.add(false);
    sleep(randSleep());
    return;
  }

  var reqParams = { headers: { "Content-Type": "application/json" }, jar: jar };
  var chosenOptionId = optionIds[Math.floor(Math.random() * optionIds.length)];

  var tokenRes = http.post(
    API_URL + "/votings/" + votingId + "/token",
    JSON.stringify({
      optionIds: [chosenOptionId],
      isPractice: false,
      isAbstention: false,
    }),
    reqParams,
  );

  if (tokenRes.status === 409) {
    alreadyVoted.add(1);
    voteSuccessRate.add(true);
    sleep(randSleep());
    return;
  }

  if (
    !check(tokenRes, {
      "token 201": function (r) {
        return r.status === 201;
      },
    })
  ) {
    console.error(
      "token failed user=" +
        userNum +
        " status=" +
        tokenRes.status +
        " body=" +
        safeBody(tokenRes).slice(0, 150),
    );
    voteSuccessRate.add(false);
    sleep(randSleep());
    return;
  }

  var rawToken;
  try {
    rawToken = tokenRes.json().token;
  } catch (_) {
    voteSuccessRate.add(false);
    sleep(randSleep());
    return;
  }

  if (!rawToken) {
    voteSuccessRate.add(false);
    sleep(randSleep());
    return;
  }

  var voteRes = http.post(
    API_URL + "/votings/" + votingId + "/vote",
    JSON.stringify({
      optionIds: [chosenOptionId],
      token: rawToken,
      isAbstention: false,
      isPractice: false,
    }),
    reqParams,
  );

  voteDuration.add(Date.now() - flowStart);

  if (voteRes.status === 409 || voteRes.status === 403) {
    alreadyVoted.add(1);
    voteSuccessRate.add(true);
    sleep(randSleep());
    return;
  }

  var voteOk = check(voteRes, {
    "vote 201": function (r) {
      return r.status === 201;
    },
    "participated = true": function (r) {
      try {
        return r.json("participated") === true;
      } catch (_) {
        return false;
      }
    },
  });

  if (voteOk) {
    voteSuccess.add(1);
    voteSuccessRate.add(true);
  } else {
    console.error(
      "vote failed user=" +
        userNum +
        " status=" +
        voteRes.status +
        " body=" +
        safeBody(voteRes).slice(0, 200),
    );
    voteFail.add(1);
    voteSuccessRate.add(false);
  }

  sleep(randSleep());
}