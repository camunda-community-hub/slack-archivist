// https://docs.discourse.org/
// https://meta.discourse.org/t/how-to-reverse-engineer-the-discourse-api/20576
// https://meta.discourse.org/t/how-to-turn-off-a-checker-for-title-seems-unclear-is-it-a-complete-sentence/55070/12
import Axios, { AxiosInstance } from "axios";
import * as E from "fp-ts/Either";
import { DiscourseConfigObject } from "./lib/Configuration";
import { RateLimiter } from "./lib/Ratelimiter";
import FormData from "form-data";
import { FileUpload } from "./PostBuilder";

const debug = require("debug")("discourse");

export interface DiscourseSuccessMessage {
  url: string;
  baseURL: string;
  topic_slug: string;
  topic_id: number;
}

export class DiscourseAPI {
  private http: AxiosInstance;
  private config: DiscourseConfigObject;
  private limit: RateLimiter;
  constructor(config: DiscourseConfigObject) {
    // To get your category id
    // http
    //   .get(`/categories`)
    //   .then(res => console.log(JSON.stringify(res.data, null, 2)));
    this.config = config;
    this.http = Axios.create({
      baseURL: config.url,
      headers: {
        "Api-Key": config.token,
        "Api-Username": config.user,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    this.http.interceptors.request.use((config) => {
      if (config.data instanceof FormData) {
        Object.assign(config.headers, config.data.getHeaders());
      }
      return config;
    });
    this.limit = new RateLimiter(500);
  }

  async addToPost(
    topic_id: number,
    raw: string
  ): Promise<E.Either<Error, DiscourseSuccessMessage>> {
    return this.limit.runRateLimited({
      task: () =>
        this.http
          .post("/posts.json", {
            topic_id,
            raw: raw,
            category: this.config.category,
          })
          .then(({ data }) =>
            E.right({
              url: `${this.config.url}t/${data.topic_slug}/${data.topic_id}`,
              baseURL: this.config.url,
              topic_slug: data.topic_slug,
              topic_id: data.topic_id,
            })
          )
          .catch((e) => E.left(new Error(e?.response?.data?.errors || e))),
    });
  }

  async createNewPost(
    title: string,
    discoursePost: string
  ): Promise<E.Either<Error, DiscourseSuccessMessage>> {
    return this.limit.runRateLimited({
      task: () =>
        this.http
          .post("/posts.json", {
            title,
            raw: discoursePost,
            category: this.config.category,
          })
          .then(({ data }) =>
            E.right({
              url: `${this.config.url}t/${data.topic_slug}/${data.topic_id}`,
              baseURL: this.config.url,
              topic_slug: data.topic_slug,
              topic_id: data.topic_id,
            })
          )
          .catch((e) =>
            E.left(new Error(e?.response?.data?.errors || e.message))
          ),
    });
  }

  async getPost(topic_id: number) {
    const req = `/t/${topic_id}.json`;
    return this.limit
      .runRateLimited({
        task: () => this.http.get(req),
      })
      .catch((e) => {
        debug(e);
        if (e.response?.status) {
          return { status: 400 };
        }
        return false as false;
      });
  }

  async uploadFile(file: FileUpload) {
    const form = new FormData();
    form.append("files[]", file.data, {
      filename: file.slackUrl,
    });
    // form.append("type", "composer");
    // form.append("synchronous", "true");

    return this.limit.runRateLimited({
      task: () =>
        this.http
          // multipart/form-data
          .post("/uploads.json", form, {
            params: {
              type: "composer",
              synchronous: true,
            },
          })
          .then(({ data }) => {
            console.info(
              "Response from Discourse",
              JSON.stringify(data, null, 2)
            );
            return {
              url: data.url,
            };
          })
          .catch((e) => {
            console.error(
              "Error uploading file to Discourse",
              JSON.stringify(e, null, 2)
            );
            throw e;
          }),
    });
  }
}
