// https://docs.discourse.org/
// https://meta.discourse.org/t/how-to-reverse-engineer-the-discourse-api/20576

import Axios from "axios";
const config = require("../config");

const discourse = config?.discourse;
const discourseToken = process.env.DISCOURSE_TOKEN || discourse?.token || "";
const discourseUser = process.env.DISCOURSE_USER || discourse?.user || "";
const discourseCategory =
  process.env.DISCOURSE_URL || discourse?.category || "";
const discourseUrl = process.env.DISCOURSE_URL || discourse?.url || "";

const http = Axios.create({
  baseURL: discourseUrl,
  headers: {
    "Api-Key": discourseToken,
    "Api-Username": discourseUser,
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

export class DiscourseAPI {
  constructor() {
    // To get your category id
    // http
    //   .get(`/categories`)
    //   .then(res => console.log(JSON.stringify(res.data, null, 2)));
  }

  post(title: string, discoursePost: string) {
    return http
      .post("/posts.json", {
        title,
        raw: discoursePost,
        category: discourseCategory
      })
      .then(
        ({ data }) => `${discourseUrl}t/${data.topic_slug}/${data.topic_id}`
      );
  }
}
