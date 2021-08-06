import { isEmpty } from "lodash";

type AppStorage = Storage | MemoryStorage

export class MemoryStorage {
  constructor(
    private readonly _storage = new Map<string, string>()
  ) {
  }

  getItem(name: string) {
    return this._storage.get(name)
  }

  setItem(name: string, value: string) {
    this._storage.set(name, value)
  }

  removeItem(name: string) {
    this._storage.delete(name)
  }
}

export class CustomStorage {

  private storage: AppStorage;

  languageKey: string = 'demo_language'

  constructor() {
    this.storage = new MemoryStorage();
  }

  useSessionStorage() {
    this.storage = window.sessionStorage
  }

  read(key: string): any {
    try {
      let json = JSON.parse(this.storage.getItem(key) as string);
      return json
    } catch(_) {
      return this.storage.getItem(key);
    }
  }

  save(key: string, val: any) {
    this.storage.setItem(key, JSON.stringify(val));
  }

  clear(key: string) {
    this.storage.removeItem(key);
  }

  setLanguage(lang: string) {
    this.save(this.languageKey, lang)
  }

  getLanguage() {
    const language = this.read(this.languageKey) ? this.read(this.languageKey) : navigator.language;
    return language;
  }

  getRtmMessage (): {count: any, messages: any[]} {
    const channelMessages = GlobalStorage.read('channelMessages');
    if (isEmpty(channelMessages)) return {
      count: 0,
      messages: []
    }
    const messages = channelMessages.filter((it: any) => it.message_type === "group_message");
    const chatMessages = messages.reduce((collect: any[], value: any) => {
      const payload = value.payload;
      const json = JSON.parse(payload);
      if (json.content) {
        return collect.concat({
          account: json.account,
          content: json.content,
          ms: value.ms,
          src: value.src
        });
      }
      return collect;
    }, []);
    return {
      messages: chatMessages,
      count: chatMessages.length
    }
  }
}

export class PersistLocalStorage {
  private storage: AppStorage;

  languageKey: string = 'app_storage'

  constructor() {
    this.storage = window.localStorage
  }

  saveCourseWareList(jsonStringify: string) {
    this.storage.setItem("courseWare", jsonStringify)
  }

  getCourseWareSaveList() {
    const str = this.storage.getItem("courseWare")
    if (!str) {
      return []
    }
    try {
      return JSON.parse(str) as []
    } catch (err) {
      return []
    }
  }

  saveSkipGuide() {
    try {
      this.storage.setItem("skip.guide.cr", "true")
    } catch(e) {
      console.error(`[local storage] save skip guide failed ${e.message}`)
    }
  }

  getSkipGuide() {
    let str
    try {
      str = this.storage.getItem("skip.guide.cr")
      return str === "true"
    } catch(e) {
      console.error(`[local storage] get skip guide failed ${e.message}`)
    }
    return true
  }

}

export const GlobalStorage = new CustomStorage();

export const storage = new PersistLocalStorage()
