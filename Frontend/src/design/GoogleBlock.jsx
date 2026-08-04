import { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useDispatch } from 'react-redux';
import { googleAuth } from '../store/authSlice';

const CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID;

export default function GoogleBlock() {
  const dispatch = useDispatch();
  const slot = useRef(null);
  const [rendered, setRendered] = useState(true);

  useEffect(() => {
    const check = () => {
      const el = slot.current;
      if (el) setRendered(el.getBoundingClientRect().height > 8);
    };
    const id = setTimeout(check, 2500);
    return () => clearTimeout(id);
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div className={rendered ? undefined : 'hidden'}>
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" aria-hidden />
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-200" aria-hidden />
      </div>

      <div ref={slot} className="flex justify-center">
        <GoogleLogin
          shape="rectangular"
          text="signin_with"
          width="320"
          onSuccess={(response) => dispatch(googleAuth(response.credential))}
          onError={() => {}}
        />
      </div>
    </div>
  );
}
