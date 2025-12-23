import { Link } from "react-router-dom";
import "../styles/NotFoundPage.css"; // Assuming you will create this CSS file

export default function NotFoundPage() {
  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">Page Not Found</h2>
        <p className="not-found-message">
          Oops! The page you are looking for doesn't exist or has been moved.
        </p>

        <div className="not-found-actions">
          <Link to="/" className="action-button primary">
            Go to Home
          </Link>
          <Link to="/groups" className="action-button secondary">
            View My Groups
          </Link>
        </div>
      </div>
    </div>
  );
}
