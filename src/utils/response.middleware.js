const sendResponse = (res, statusCode, success, message, data = null, errors = null) => {
    const response = {
        success,
        statusCode,
        message
    };

    if (data) {
        response.data = data
    }

    const formatError = (err) => {
        if (!err) return err

        // If it's an Error instance, return only name and message
        if (err instanceof Error) {
            const { name, message: msg } = err
            return { name, message: msg }
        }

        // If it's an array of errors, format each entry
        if (Array.isArray(err)) return err.map(formatError)

        // If it's an object, return only name (if present) and message
        if (typeof err === 'object') {
            const name = err.name
            const message = err.message || JSON.stringify(err)
            return { ...(name ? { name } : {}), message }
        }

        return { message: String(err) }
    }

    if (errors) {
        response.errors = formatError(errors)
    }

    // Handle/replace bigint for JSON.Stringify()
    const jsonBigIntReplacer = (_, value) =>
        typeof value === 'bigint' ? value.toString() : value

    res.status(statusCode)
    res.setHeader('Content-Type', 'application/json')
    return res.send(JSON.stringify(response, jsonBigIntReplacer))
}

export default sendResponse