import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore';

export default defineNuxtPlugin(nuxtApp => {
    const firebaseConfig = {
      apiKey: "<your config>",
      authDomain: "<your config>",
      projectId: "<your config>",
      storageBucket: "<your config>",
      messagingSenderId: "<your config>",
      appId: "<your config>"
    };

    // const app = initializeApp(firebaseConfig)
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const firestore = firebase.firestore();

    nuxtApp.vueApp.provide('firestore', firestore)
    nuxtApp.provide('firestore', firestore)
})