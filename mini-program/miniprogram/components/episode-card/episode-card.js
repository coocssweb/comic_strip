Component({
  properties: {
    episode: {
      type: Object,
      value: {},
    },
  },

  methods: {
    handleOpen() {
      this.triggerEvent('open', { episodeId: this.properties.episode.id });
    },
  },
});
