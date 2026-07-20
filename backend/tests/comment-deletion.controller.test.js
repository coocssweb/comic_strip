import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteAdminComment } from '../src/controllers/admin-comment.controller.js';
import { deleteComment } from '../src/controllers/interaction.controller.js';
import { Comment } from '../src/models/comment.model.js';
import { Episode } from '../src/models/episode.model.js';

test('管理员与读者交错删除时保留管理员首次写入的审计信息', async (testContext) => {
  const originalFindOne = Comment.findOne;
  const originalFindOneAndUpdate = Comment.findOneAndUpdate;
  const originalExists = Comment.exists;
  const originalEpisodeExists = Episode.exists;
  let signalReaderOperation;
  const readerOperationReached = new Promise((resolve) => {
    signalReaderOperation = resolve;
  });
  let continueReaderSave;
  const allowReaderSave = new Promise((resolve) => {
    continueReaderSave = resolve;
  });
  let storedComment = {
    _id: 'comment-1',
    deletedAt: null,
    deletedByRole: null,
    deletedById: null,
  };
  const readerComment = {
    _id: 'comment-1',
    episodeId: 'episode-1',
    readerId: { _id: 'reader-1' },
    async save() {
      signalReaderOperation();
      await allowReaderSave;
      storedComment = {
        ...storedComment,
        deletedAt: this.deletedAt,
        deletedByRole: this.deletedByRole,
        deletedById: this.deletedById,
      };
    },
  };

  Comment.findOne = () => ({
    async populate() {
      return readerComment;
    },
  });
  Comment.findOneAndUpdate = async (filter, update) => {
    if (update.$set.deletedByRole === 'reader') {
      signalReaderOperation();
      await allowReaderSave;
    }

    if (storedComment.deletedAt) {
      return null;
    }

    storedComment = { ...storedComment, ...update.$set };
    return storedComment;
  };
  Comment.exists = async () => ({ _id: storedComment._id });
  Episode.exists = async () => true;
  testContext.after(() => {
    Comment.findOne = originalFindOne;
    Comment.findOneAndUpdate = originalFindOneAndUpdate;
    Comment.exists = originalExists;
    Episode.exists = originalEpisodeExists;
  });

  const readerDeletion = deleteComment({
    params: { commentId: 'comment-1' },
    state: { auth: { role: 'reader', subjectId: 'reader-1' } },
    ok() {},
  });
  await readerOperationReached;
  await deleteAdminComment({
    params: { commentId: 'comment-1' },
    state: { auth: { subjectId: 'admin-1' } },
    ok() {},
  });
  const firstAudit = {
    deletedAt: storedComment.deletedAt,
    deletedByRole: storedComment.deletedByRole,
    deletedById: storedComment.deletedById,
  };
  continueReaderSave();

  await assert.rejects(readerDeletion, (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'COMMENT_ALREADY_DELETED');
    return true;
  });
  assert.deepEqual(
    {
      deletedAt: storedComment.deletedAt,
      deletedByRole: storedComment.deletedByRole,
      deletedById: storedComment.deletedById,
    },
    firstAudit,
  );
});
