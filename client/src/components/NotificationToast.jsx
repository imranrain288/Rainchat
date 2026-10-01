

const NotificationToast = ({ message, type }) => {
	return (
		<div className={`alert alert-${type}`}>
			{message}
		</div>
	)
}

export default NotificationToast