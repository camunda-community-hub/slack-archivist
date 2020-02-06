// https://docs.discourse.org/
// https://meta.discourse.org/t/how-to-reverse-engineer-the-discourse-api/20576

import Axios from "axios";
import {
  discourseUrl,
  discourseToken,
  discourseUser,
  discourseCategory
} from "./Configurator";

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
