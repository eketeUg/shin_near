const mocks = {
    randomBytes: (size) => new Uint8Array(size),
    createHash: () => ({ update: () => ({ digest: () => '' }) }),
    createCipheriv: () => ({ update: () => '', final: () => '' }),
    createDecipheriv: () => ({ update: () => '', final: () => '' }),
    parse: () => ({ root: '', dir: '', base: '', ext: '', name: '' }),
    join: () => '',
    resolve: () => '',
    basename: () => '',
    dirname: () => '',
    extname: () => '',
};

module.exports = {
    ...mocks,
    default: mocks
};
