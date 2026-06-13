export default function Loading() {
  return (
    <div id="loader" role="status" aria-label="Establishing connection">
      <div className="loader-ring">
        <img src="/assets/sith_order.svg" alt="" className="loader-logo" />
      </div>
      <div className="loader-text">Establishing Link&hellip;</div>
      <div className="loader-bar-wrap">
        <div className="loader-bar" />
      </div>
    </div>
  );
}
