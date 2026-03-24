import React from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import BoardHeader from '../components/Board/BoardHeader';
import ThreadList from '../components/Thread/ThreadList';
import PostForm from '../components/Thread/PostForm';
import boardsData from '../data/boards.json';

const BoardPage = () => {
  const { boardId } = useParams();
  const board = boardsData.boards.find(b => b.id === boardId);

  if (!board) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem', animation: 'fadeUp 0.5s ease' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
        <h1 style={{ marginBottom: '0.5rem' }}>Board Not Found</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          The board <strong style={{ color: 'var(--brand-gold)' }}>/{boardId}/</strong> doesn't exist.
        </p>
        <Link to="/" className="btn btn-primary">← Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="board-page" style={{ animation: 'fadeIn 0.4s ease' }}>
      <BoardHeader board={board} />
      <div className="board-content">
        <PostForm
          boardId={boardId}
          isNewThread={true}
          placeholder={`Share anonymously in /${boardId}/…`}
        />
        <ThreadList boardId={boardId} />
      </div>
    </div>
  );
};

export default BoardPage;
