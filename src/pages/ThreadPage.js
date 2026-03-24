import React from 'react';
import { useParams } from 'react-router-dom';
import ThreadView from '../components/Thread/ThreadView';
import PostForm from '../components/Thread/PostForm';

const ThreadPage = () => {
  const { threadId } = useParams();

  return (
    <div className="thread-page">
      <ThreadView threadId={threadId} />
      
      <PostForm 
        threadId={threadId}
        isNewThread={false}
        placeholder="Reply anonymously to this thread..."
      />
    </div>
  );
};

export default ThreadPage;
